import argparse
import logging
import os
import tempfile
import time
from pathlib import Path

import pandas as pd

from contracts import load_scenarios, parse_symbols


LOGGER = logging.getLogger("marketrisk.spark")


def _download_yfinance_csv(symbols, period, output_path, chunk_size):
    import yfinance as yf

    price_frames = []
    for offset in range(0, len(symbols), chunk_size):
        chunk = symbols[offset : offset + chunk_size]
        downloaded = yf.download(
            tickers=chunk,
            period=period,
            auto_adjust=True,
            group_by="ticker",
            threads=True,
            progress=False,
        )
        if downloaded.empty:
            LOGGER.warning("No rows returned for ticker chunk beginning %s", chunk[0])
            continue

        for ticker in chunk:
            if isinstance(downloaded.columns, pd.MultiIndex):
                levels = [downloaded.columns.get_level_values(i) for i in range(downloaded.columns.nlevels)]
                matching_level = next((i for i, level in enumerate(levels) if ticker in level), None)
                if matching_level is None:
                    continue
                ticker_frame = downloaded.xs(ticker, axis=1, level=matching_level)
            else:
                ticker_frame = downloaded

            close_column = next(
                (column for column in ticker_frame.columns if str(column).lower() == "close"),
                None,
            )
            if close_column is None:
                LOGGER.warning("No close-price column returned for %s", ticker)
                continue
            ticker_prices = ticker_frame[[close_column]].rename(columns={close_column: "close"}).reset_index()
            date_column = ticker_prices.columns[0]
            ticker_prices = ticker_prices.rename(columns={date_column: "trade_date"})
            ticker_prices["ticker"] = ticker
            price_frames.append(ticker_prices[["ticker", "trade_date", "close"]])

    if not price_frames:
        raise RuntimeError("The configured yfinance source returned no usable close prices")
    pd.concat(price_frames, ignore_index=True).to_csv(output_path, index=False)


def _parse_args():
    parser = argparse.ArgumentParser(description="Compute portfolio risk from historical prices with local Spark")
    parser.add_argument("--source", choices=("csv", "parquet", "yfinance"), default="csv")
    parser.add_argument("--prices", help="CSV or Parquet input path; required for csv/parquet sources")
    parser.add_argument("--tickers", default="", help="Comma-separated tickers for the yfinance source")
    parser.add_argument("--symbols-file", help="Text file with one ticker per line for yfinance")
    parser.add_argument("--period", default="5y", help="yfinance history period, for example 1y or 5y")
    parser.add_argument("--download-chunk-size", type=int, default=50)
    parser.add_argument("--holdings", required=True, help="CSV with ticker and shares, or ticker and weight")
    parser.add_argument("--scenarios", help="JSON mapping scenario names to ticker shock returns")
    parser.add_argument("--raw-output", default="data/spark/raw_prices")
    parser.add_argument("--results-output", default="data/spark/risk_results")
    parser.add_argument("--object-store-output", action="store_true", help="Write all shared datasets under s3a://market-risk")
    parser.add_argument("--start-date", help="Inclusive ISO date filter, such as 2020-01-01")
    parser.add_argument("--end-date", help="Inclusive ISO date filter, such as 2025-12-31")
    parser.add_argument("--simulations", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--shuffle-partitions", type=int, default=8)
    parser.add_argument("--master", help="Optional Spark master override; otherwise inherit spark-submit")
    return parser.parse_args()


def _spark_job(args, prices_path, prices_format):
    from pyspark.sql import SparkSession, Window
    from pyspark.sql import functions as F

    builder = (
        SparkSession.builder.appName("MarketRiskPortfolioBatch")
        .config("spark.sql.shuffle.partitions", str(args.shuffle_partitions))
        .config("spark.sql.adaptive.enabled", "true")
    )
    object_store_endpoint = os.getenv("MINIO_ENDPOINT")
    if object_store_endpoint:
        builder = (
            builder.config("spark.hadoop.fs.s3a.endpoint", object_store_endpoint)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
            .config(
                "spark.hadoop.fs.s3a.aws.credentials.provider",
                "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider",
            )
            .config("spark.hadoop.fs.s3a.access.key", os.environ["AWS_ACCESS_KEY_ID"])
            .config("spark.hadoop.fs.s3a.secret.key", os.environ["AWS_SECRET_ACCESS_KEY"])
        )
    if args.master:
        builder = builder.master(args.master)
    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel("WARN")
    run_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    run_date = run_id[:8]

    try:
        if prices_format == "csv":
            prices = spark.read.option("header", True).option("inferSchema", True).csv(prices_path)
        elif prices_format == "yfinance":
            downloaded_prices = pd.read_csv(prices_path)
            prices = spark.createDataFrame(
                downloaded_prices[["ticker", "trade_date", "close"]].to_dict("records")
            )
        else:
            prices = spark.read.parquet(prices_path)
        source_year = (
            F.col("year").cast("int")
            if "year" in prices.columns
            else F.year(F.to_date(F.col("trade_date")))
        )
        prices = prices.select(
            F.upper(F.trim(F.col("ticker"))).alias("ticker"),
            F.to_date(F.col("trade_date")).alias("trade_date"),
            F.col("close").cast("double").alias("close"),
            source_year.alias("year"),
        ).filter(
            F.col("ticker").isNotNull()
            & F.col("trade_date").isNotNull()
            & F.col("close").isNotNull()
            & (F.col("close") > 0)
        )
        if args.start_date:
            prices = prices.filter(
                (F.col("year") >= int(args.start_date[:4]))
                & (F.col("trade_date") >= F.to_date(F.lit(args.start_date)))
            )
        if args.end_date:
            prices = prices.filter(
                (F.col("year") <= int(args.end_date[:4]))
                & (F.col("trade_date") <= F.to_date(F.lit(args.end_date)))
            )

        prices.write.mode("overwrite").partitionBy("year").parquet(args.raw_output)
        prices = spark.read.parquet(args.raw_output)
        rows_processed = prices.count()

        latest_window = Window.partitionBy("ticker").orderBy(F.col("trade_date").desc())
        latest_prices = (
            prices.withColumn("row_number", F.row_number().over(latest_window))
            .filter(F.col("row_number") == 1)
            .select("ticker", F.col("close").alias("latest_close"))
        )
        holdings = spark.read.option("header", True).option("inferSchema", True).csv(args.holdings)
        holdings = holdings.select(
            F.upper(F.trim(F.col("ticker"))).alias("ticker"),
            *([F.col("shares").cast("double").alias("shares")] if "shares" in holdings.columns else []),
            *([F.col("weight").cast("double").alias("input_weight")] if "weight" in holdings.columns else []),
        )
        if "shares" in holdings.columns:
            holdings = holdings.join(F.broadcast(latest_prices), "ticker", "inner").withColumn(
                "market_value", F.col("shares") * F.col("latest_close")
            )
            portfolio_value = holdings.agg(F.sum("market_value").alias("value")).first()["value"]
            if not portfolio_value or portfolio_value <= 0:
                raise ValueError("Holdings did not match positive latest prices")
            weights = holdings.withColumn("weight", F.col("market_value") / F.lit(portfolio_value)).select(
                "ticker", "weight"
            )
        elif "input_weight" in holdings.columns:
            weight_total = holdings.agg(F.sum("input_weight").alias("total")).first()["total"]
            if not weight_total or weight_total <= 0:
                raise ValueError("Holdings weights must sum to a positive value")
            portfolio_value = None
            weights = holdings.withColumn("weight", F.col("input_weight") / F.lit(weight_total)).select(
                "ticker", "weight"
            )
        else:
            raise ValueError("Holdings CSV must contain ticker and either shares or weight")

        price_window = Window.partitionBy("ticker").orderBy("trade_date")
        returns = (
            prices.repartition(args.shuffle_partitions, "ticker")
            .sortWithinPartitions("ticker", "trade_date")
            .withColumn("previous_close", F.lag("close").over(price_window))
            .filter(F.col("previous_close").isNotNull() & (F.col("previous_close") > 0))
            .withColumn("asset_return", F.col("close") / F.col("previous_close") - F.lit(1.0))
            .join(F.broadcast(weights), "ticker", "inner")
            .groupBy("trade_date")
            .agg(
                F.sum(F.col("asset_return") * F.col("weight")).alias("weighted_return"),
                F.sum("weight").alias("available_weight"),
            )
            .withColumn("portfolio_return", F.col("weighted_return") / F.col("available_weight"))
            .select("trade_date", "portfolio_return")
        )
        intermediate_path = f"{args.results_output.rstrip('/')}/portfolio_returns"
        (
            returns.withColumn("run_id", F.lit(run_id))
            .withColumn("run_date", F.lit(run_date))
            .write.mode("append")
            .partitionBy("run_date", "run_id")
            .parquet(intermediate_path)
        )
        losses = returns.select((-F.col("portfolio_return")).alias("loss"))
        return_rows = returns.count()
        if return_rows < 30:
            raise ValueError(
                "At least 30 portfolio return observations are required; "
                f"found {return_rows}"
            )
        historical = losses.agg(
            F.percentile_approx("loss", 0.95, 10000).alias("var_95_return"),
            F.percentile_approx("loss", 0.99, 10000).alias("var_99_return"),
        )
        historical_tail = losses.crossJoin(historical.select("var_95_return")).filter(
            F.col("loss") >= F.col("var_95_return")
        ).agg(F.avg("loss").alias("cvar_95_return"))
        historical = historical.crossJoin(historical_tail).withColumn("portfolio_id", F.lit(1))

        if args.simulations < 100 or args.simulations > 1_000_000:
            raise ValueError("--simulations must be between 100 and 1000000")
        return_stats = returns.agg(
            F.avg("portfolio_return").alias("mean_return"),
            F.stddev_samp("portfolio_return").alias("std_return"),
        )
        simulated = (
            return_stats.crossJoin(spark.range(args.simulations))
            .withColumn(
                "simulated_loss",
                -(F.col("mean_return") + F.col("std_return") * F.randn(args.seed)),
            )
        )
        monte_carlo = simulated.agg(
            F.percentile_approx("simulated_loss", 0.95, 10000).alias("mc_var_95_return"),
            F.percentile_approx("simulated_loss", 0.99, 10000).alias("mc_var_99_return"),
        )
        mc_tail = simulated.crossJoin(monte_carlo.select("mc_var_95_return")).filter(
            F.col("simulated_loss") >= F.col("mc_var_95_return")
        ).agg(F.avg("simulated_loss").alias("mc_cvar_95_return"))
        metrics = (
            historical.crossJoin(monte_carlo).crossJoin(mc_tail)
            .withColumn("run_id", F.lit(run_id))
            .withColumn("run_date", F.lit(run_date))
            .withColumn("price_rows", F.lit(rows_processed))
            .withColumn("return_rows", F.lit(return_rows))
            .withColumn("simulations", F.lit(args.simulations))
            .withColumn("var_95_pct", F.col("var_95_return") * 100.0)
            .withColumn("var_99_pct", F.col("var_99_return") * 100.0)
            .withColumn("cvar_95_pct", F.col("cvar_95_return") * 100.0)
            .withColumn("mc_var_95_pct", F.col("mc_var_95_return") * 100.0)
            .withColumn("mc_var_99_pct", F.col("mc_var_99_return") * 100.0)
            .withColumn("mc_cvar_95_pct", F.col("mc_cvar_95_return") * 100.0)
            .select(
                "portfolio_id", "run_id", "run_date", "price_rows", "return_rows", "simulations",
                "var_95_pct", "var_99_pct", "cvar_95_pct", "mc_var_95_pct", "mc_var_99_pct",
                "mc_cvar_95_pct",
            )
        )

        scenarios = load_scenarios(args.scenarios)
        scenario_rows = [
            (name, ticker, float(shock))
            for name, ticker_shocks in scenarios.items()
            for ticker, shock in ticker_shocks.items()
        ]
        scenario_df = spark.createDataFrame(scenario_rows, ["scenario", "ticker", "shock"])
        names = scenario_df.select("scenario").distinct()
        specific = scenario_df.filter(F.col("ticker") != "*").select(
            "scenario", "ticker", F.col("shock").alias("specific_shock")
        )
        defaults = scenario_df.filter(F.col("ticker") == "*").select(
            "scenario", F.col("shock").alias("default_shock")
        )
        exposures = (
            names.crossJoin(F.broadcast(weights))
            .join(F.broadcast(specific), ["scenario", "ticker"], "left")
            .join(F.broadcast(defaults), "scenario", "left")
            .withColumn("shock", F.coalesce("specific_shock", "default_shock", F.lit(0.0)))
        )
        stress = exposures.groupBy("scenario").agg(
            F.sum(F.col("weight") * F.col("shock")).alias("scenario_return")
        )
        if portfolio_value is not None:
            stress = stress.withColumn("estimated_loss", F.greatest(-F.col("scenario_return"), F.lit(0.0)) * F.lit(portfolio_value))
            stress = stress.withColumn("remaining_value", F.lit(portfolio_value) * (F.lit(1.0) + F.col("scenario_return")))
        else:
            stress = stress.withColumn("estimated_loss", F.lit(None).cast("double"))
            stress = stress.withColumn("remaining_value", F.lit(None).cast("double"))
        stress = (
            stress.withColumn("portfolio_id", F.lit(1))
            .withColumn("run_id", F.lit(run_id))
            .withColumn("run_date", F.lit(run_date))
            .withColumn("scenario_return_pct", F.col("scenario_return") * 100.0)
            .drop("scenario_return")
        )

        metrics_path = f"{args.results_output.rstrip('/')}/risk_metrics"
        stress_path = f"{args.results_output.rstrip('/')}/stress_results"
        metrics.write.mode("append").partitionBy("run_date").parquet(metrics_path)
        stress.write.mode("append").partitionBy("run_date").parquet(stress_path)
        LOGGER.info(
            "Completed run_id=%s price_rows=%s return_rows=%s scenarios=%s output=%s",
            run_id,
            rows_processed,
            metrics.first()["return_rows"],
            len(scenarios),
            args.results_output,
        )
    finally:
        spark.stop()


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = _parse_args()
    if args.source in ("csv", "parquet") and not args.prices:
        raise SystemExit("--prices is required when --source is csv or parquet")

    temporary = None
    prices_path = args.prices
    prices_format = args.source
    if args.object_store_output:
        args.raw_output = "s3a://market-risk/raw-prices"
        args.results_output = "s3a://market-risk/risk-results"
    if args.source == "yfinance":
        if args.download_chunk_size < 1:
            raise SystemExit("--download-chunk-size must be positive")
        symbols = parse_symbols(args.tickers, args.symbols_file)
        temporary = tempfile.TemporaryDirectory(prefix="marketrisk-prices-")
        prices_path = str(Path(temporary.name) / "prices.csv")
        _download_yfinance_csv(symbols, args.period, prices_path, args.download_chunk_size)
        prices_format = "yfinance"

    try:
        _spark_job(args, prices_path, prices_format)
    finally:
        if temporary is not None:
            temporary.cleanup()


if __name__ == "__main__":
    main()