from fastapi import APIRouter, HTTPException
from app.services.market import get_history, get_prices_bulk
from app.services.risk import calc_returns, calc_var, calc_cvar, calc_sharpe, calc_sortino, calc_beta, calc_alpha, calc_max_drawdown, calc_volatility, calc_correlation_matrix, monte_carlo_var, risk_grade
from app.services.database import get_db
import pandas as pd, numpy as np, time

router = APIRouter()

@router.get("/portfolio")
async def portfolio_risk():
    conn = get_db()
    holdings = conn.execute("SELECT ticker, shares FROM holdings WHERE portfolio_id=1").fetchall()
    conn.close()
    if not holdings: return {"error":"No holdings"}
    tickers = [h["ticker"] for h in holdings]
    weights_raw = {h["ticker"]:h["shares"] for h in holdings}
    all_returns = {}
    for ticker in tickers:
        df = get_history(ticker, "1y")
        if not df.empty: all_returns[ticker] = calc_returns(df["Close"])
    if not all_returns: return {"error":"Could not fetch data"}
    spy_df = get_history("SPY","1y")
    market_returns = calc_returns(spy_df["Close"]) if not spy_df.empty else None
    returns_df = pd.DataFrame(all_returns).dropna()
    if returns_df.empty: return {"error":"Insufficient data"}
    prices_now = get_prices_bulk(tickers)
    total_value = sum(weights_raw.get(t,0)*prices_now.get(t,{}).get("price",0) for t in tickers)
    weights_arr = np.array([weights_raw.get(t,0)*prices_now.get(t,{}).get("price",0)/total_value if total_value>0 else 1/len(tickers) for t in returns_df.columns])
    portfolio_returns = returns_df.dot(weights_arr)
    beta = calc_beta(portfolio_returns, market_returns) if market_returns is not None else 1.0
    alpha = calc_alpha(portfolio_returns, market_returns, beta) if market_returns is not None else 0.0
    portfolio_prices = (1+portfolio_returns).cumprod()
    holding_risks = []
    for ticker in returns_df.columns:
        r = returns_df[ticker]
        mkt = market_returns if market_returns is not None else r
        holding_risks.append({"ticker":ticker,"weight":round(weights_arr[list(returns_df.columns).index(ticker)]*100,1),
            "var_95":round(calc_var(r,0.95)*100,2),"volatility":round(calc_volatility(r),2),
            "sharpe":round(calc_sharpe(r),2),"beta":round(calc_beta(r,mkt),2)})
    corr = calc_correlation_matrix({t:returns_df[t] for t in returns_df.columns})
    mc = monte_carlo_var(portfolio_returns, n_simulations=10000)
    max_dd, peak, trough = calc_max_drawdown(portfolio_prices)
    var_95 = calc_var(portfolio_returns, 0.95)
    report = {"var_95":round(var_95*100,2),"var_99":round(calc_var(portfolio_returns,0.99)*100,2),
        "cvar_95":round(calc_cvar(portfolio_returns,0.95)*100,2),"sharpe_ratio":round(calc_sharpe(portfolio_returns),3),
        "sortino_ratio":round(calc_sortino(portfolio_returns),3),"beta":round(beta,3),"alpha":round(alpha,3),
        "volatility":round(calc_volatility(portfolio_returns),2),"max_drawdown":round(max_dd,2),
        "max_drawdown_peak":peak,"max_drawdown_trough":trough,"monte_carlo":mc,
        "holding_risks":sorted(holding_risks,key=lambda x:x["var_95"],reverse=True),
        "correlation":corr,"risk_grade":risk_grade(var_95),
        "interpretation":{"var_summary":f"On any given day, there's a 5% chance of losing more than {round(var_95*100,1)}% of portfolio value.",
            "sharpe_summary":"Excellent risk-adjusted returns." if calc_sharpe(portfolio_returns)>2 else "Good risk-adjusted returns." if calc_sharpe(portfolio_returns)>1 else "Moderate returns for the risk taken." if calc_sharpe(portfolio_returns)>0 else "Poor risk-adjusted returns.",
            "beta_summary":f"Portfolio moves {round(abs(beta),1)}x the market — {'more' if beta>1 else 'less'} volatile than S&P 500."}}
    conn = get_db()
    conn.execute("INSERT INTO risk_snapshots (portfolio_id,var_95,var_99,sharpe_ratio,beta,volatility,max_drawdown,snapshot_date,created_at) VALUES (1,?,?,?,?,?,?,?,?)",
        (report["var_95"],report["var_99"],report["sharpe_ratio"],report["beta"],report["volatility"],report["max_drawdown"],time.strftime("%Y-%m-%d"),int(time.time())))
    conn.commit(); conn.close()
    return report

@router.get("/ticker/{ticker}")
async def ticker_risk(ticker: str, period: str = "1y"):
    df = get_history(ticker.upper(), period)
    if df.empty: raise HTTPException(404, f"No data for {ticker}")
    returns = calc_returns(df["Close"])
    spy = get_history("SPY", period)
    market_returns = calc_returns(spy["Close"]) if not spy.empty else returns
    beta = calc_beta(returns, market_returns)
    max_dd, peak, trough = calc_max_drawdown(df["Close"])
    mc = monte_carlo_var(returns, n_simulations=5000)
    var_95 = calc_var(returns, 0.95)
    return {"ticker":ticker.upper(),"period":period,"var_95":round(var_95*100,2),"var_99":round(calc_var(returns,0.99)*100,2),
        "cvar_95":round(calc_cvar(returns,0.95)*100,2),"sharpe_ratio":round(calc_sharpe(returns),3),
        "sortino_ratio":round(calc_sortino(returns),3),"beta":round(beta,3),"alpha":round(calc_alpha(returns,market_returns,beta),3),
        "volatility":round(calc_volatility(returns),2),"max_drawdown":round(max_dd,2),"max_drawdown_peak":peak,
        "max_drawdown_trough":trough,"monte_carlo":mc,"risk_grade":risk_grade(var_95)}

@router.get("/history")
async def risk_history():
    conn = get_db()
    rows = conn.execute("SELECT * FROM risk_snapshots WHERE portfolio_id=1 ORDER BY created_at DESC LIMIT 30").fetchall()
    conn.close()
    return {"snapshots":[dict(r) for r in rows]}

@router.get("/stress-test")
async def stress_test():
    SCENARIOS = {"2020 COVID Crash":-0.34,"2022 Bear Market":-0.25,"2008 Financial Crisis":-0.57,"2000 Dot-com Crash":-0.49,"1987 Black Monday":-0.23}
    conn = get_db()
    holdings = conn.execute("SELECT ticker,shares FROM holdings WHERE portfolio_id=1").fetchall()
    conn.close()
    prices = get_prices_bulk([h["ticker"] for h in holdings])
    total_value = sum(h["shares"]*prices.get(h["ticker"],{}).get("price",0) for h in holdings)
    results = []
    for scenario,market_drop in SCENARIOS.items():
        portfolio_drop = market_drop * 1.1
        results.append({"scenario":scenario,"market_drop_pct":round(market_drop*100,1),
            "portfolio_drop_pct":round(portfolio_drop*100,1),"estimated_loss":round(total_value*abs(portfolio_drop),2),
            "remaining_value":round(total_value+(total_value*portfolio_drop),2)})
    return {"total_value":round(total_value,2),"stress_tests":results}
