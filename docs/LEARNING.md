# MarketRisk Learning Notes

This log records what each phase demonstrates. Entries distinguish working code from planned infrastructure.

## Phase 1: local PySpark risk job

Implemented in `backend/spark_jobs/`.

- **DataFrames and Parquet:** the job normalizes provider data to ticker/date/close rows and stores raw observations in Parquet. Columnar storage supports projection and date filtering without loading every field.
- **Partitioning:** raw input is partitioned by year for date pruning. The return calculation repartitions by ticker and sorts within partitions because each ticker's lag window needs ordered rows. Those operations can cause shuffles; inspect Spark's plan and tune partition counts with measured data rather than assuming more partitions are always faster.
- **Window functions:** `lag(close)` computes each symbol's previous close and daily return. Window execution requires a shuffle/sort by its partition and ordering keys.
- **Joins:** holdings are a small dimension for the pilot and are broadcast to avoid a large-side shuffle. Broadcast joins trade network shuffle for executor memory; don't use them blindly when the dimension grows.
- **Aggregations and approximate quantiles:** grouped portfolio returns and `percentile_approx` keep large return sets distributed rather than collecting them to the driver. Accuracy is an explicit CPU/memory tradeoff.
- **Intermediate outputs:** daily weighted returns are written to a run-ID-partitioned Parquet dataset so later risk calculations can be audited and benchmarked against the exact intermediate series.
- **Monte Carlo:** Spark generates seeded normal draws distributed across rows. Reproducible seeds help compare runs; a Gaussian model is a teaching baseline, not a complete market-risk model.
- **Source abstraction:** use `--source yfinance`, `--source csv`, or `--source parquet`. yfinance is useful for a modest real-data pilot, but is not an SLA-backed large-universe feed.
- **Stress scenarios:** JSON can set a wildcard shock and ticker-specific overrides. Stress outputs disclose assumptions rather than presenting generic shocks as historical facts.

### Run and inspect

Install Java 17 (or another supported Java 17+ runtime), install `backend/spark_jobs/requirements.txt` into the Python environment used by Spark, and make sure `spark-submit` is on `PATH`. Example from the repository root:

```bash
spark-submit backend/spark_jobs/risk_batch.py \
  --source yfinance \
  --tickers AAPL,MSFT,NVDA \
  --period 5y \
  --holdings backend/spark_jobs/example_holdings.csv
```

Alternative normalized input schema:

```text
ticker,trade_date,close
AAPL,2024-01-02,185.64
```

Run the same job with `--source csv --prices path/to/prices.csv` or `--source parquet --prices path/to/prices/`. Holdings CSV must have `ticker` plus either `shares` or `weight`. Configure shocks with `--scenarios path/to/scenarios.json`. Results go under `data/spark/` by default. These paths are local in Phase 1; later phases move object storage to MinIO.

Run the dependency-free input contract tests from `backend/` with:

```bash
./venv/bin/python -m unittest discover -s tests
```

## Phase 2: containers and Compose

- **Image boundaries:** the FastAPI image and Spark image have separate dependencies. The Spark image needs a JVM and PySpark, while serving API requests does not; separating them avoids shipping the Spark runtime with every API replica.
- **Build layers:** dependency manifests are copied and installed before application source. Docker can reuse that expensive layer when only code changes.
- **Long-running versus batch lifecycle:** Compose runs frontend and API as services, while Spark is behind the opt-in `batch` profile and runs with `--rm`. In Kubernetes the analogous distinction will be Deployments versus SparkApplication resources.
- **Persistent versus ephemeral state:** SQLite uses a named volume and Spark outputs use a host mount. Container filesystems are disposable; explicit volumes make the state boundary visible.
- **Build-time frontend config:** `NEXT_PUBLIC_API_URL` is passed as a build argument because Next.js embeds public environment values into browser code at build time. The value is a public URL, not a secret.
- **Smoke checks:** Compose health gating waits for the API before the frontend starts. The same API health endpoint is used for local verification and can later inform Kubernetes probes.

## Phase 3: k3d, Spark Operator, and MinIO

- **Kubernetes objects:** the API and frontend are Deployments behind Services; SQLite is backed by a PVC. A SparkApplication creates a finite driver/executor workload, while ScheduledSparkApplication models recurring submissions.
- **Official Spark runtime:** use the Apache Spark image's native entrypoint. It translates the Operator's `driver` and `executor` roles into Spark's supported client-driver/executor launch commands. A custom role launcher can accidentally submit a second driver or omit executor environment-based connection parameters.
- **Driver/executor service contract:** the Operator pre-creates the driver pod and sets a driver service URL. Executors receive driver URL, executor ID, cores, app ID, and resource profile through environment variables. The driver service account needs scoped permissions to create/list/clean up only the Spark resources in its namespace.
- **Shared storage:** pod-local `/tmp` is not shared between driver and executor pods. S3A points at MinIO, so all task processes can read/write the same Parquet objects. The Hadoop AWS connector and AWS SDK jars must match the Hadoop version bundled in the Spark image.
- **Secret injection:** MinIO credentials are created as a Kubernetes Secret outside Git and injected into driver/executor environment. Non-secret endpoint and path-style settings remain ordinary configuration.
- **Nightly scheduling:** the schedule is UTC and concurrency is `Forbid`, avoiding overlapping runs that overwrite a shared raw-price prefix. Result partitions include a run date/ID to preserve each run's outputs.
- **Local scheduling caution:** a nightly schedule is illustrative in a laptop cluster; suspend it during experiments and remember the cluster has to remain running for scheduled jobs to execute.

## Phase 4: ArgoCD and GitOps

- **Declarative state:** ArgoCD watches Git and reconciles the cluster to match the desired manifests. The value is not just deployment convenience; it makes the Kubernetes state auditable, reviewable, and revertible.
- **App-of-apps pattern:** a root app points at the infra repo and then creates child apps for platform services and application workloads. This keeps the cluster topology explicit and makes dependency ordering easier to reason about.
- **Sync waves:** an app-of-apps setup often deploys namespaces and cluster-scoped prerequisites before services, then the application workloads. Without this ordering, the cluster can briefly fail because a native resource or required secret is missing.
- **Drift detection:** ArgoCD continuously checks whether the cluster still matches Git. If someone changes a manifest or a pod drifts, ArgoCD self-heals the cluster back to the declarative source of truth.
- **Rollbacks:** a revert in Git is the rollback mechanism. This is a good interview concept because it demonstrates operational maturity, not just deployment automation.
- **Practical caution:** the app-of-apps root is intentionally a separate infra repository and not the application repo. Keeping them separate makes team ownership clear and prevents application code changes from mutating cluster platform configuration.

## Later phases (planned)

- **Kubernetes:** image immutability, Spark driver/executor roles, resource requests/limits, and the boundary between a batch workload and a web service.
- **Spark Operator:** `SparkApplication` as a Kubernetes custom resource; `ScheduledSparkApplication` for recurring submissions; status and retries become observable through Kubernetes objects.
- **CI/GitOps:** GitHub Actions builds and pushes GHCR images and commits an immutable image tag update to infra Git. CI does not issue `kubectl apply`; ArgoCD observes Git and reconciles the cluster.
- **Benchmarking:** record input rows, scenarios, partition settings, run ID, elapsed time, and output row counts. Benchmark on the same data and hardware, and compare correctness as well as runtime.