from fastapi import APIRouter
from app.services.market import get_company_info, get_history, get_prices_bulk
from app.services.risk import calc_returns, calc_var, calc_sharpe, calc_volatility, calc_beta
import pandas as pd

router = APIRouter()
POPULAR = ["AAPL","MSFT","GOOGL","NVDA","TSLA","AMZN","META","JPM","V","NFLX","AMD","INTC","CRM","ADBE","PYPL","UBER","SHOP","COIN","PLTR","SNOW"]

@router.get("/screener")
async def screener():
    prices = get_prices_bulk(POPULAR)
    return {"stocks":list(prices.values()),"count":len(prices)}

@router.get("/compare")
async def compare(tickers: str, period: str = "1y"):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:6]
    spy_df = get_history("SPY", period)
    market_returns = calc_returns(spy_df["Close"]) if not spy_df.empty else None
    results = []
    for ticker in ticker_list:
        df = get_history(ticker, period)
        if df.empty: continue
        returns = calc_returns(df["Close"])
        beta = calc_beta(returns, market_returns) if market_returns is not None else 1.0
        start, end = float(df["Close"].iloc[0]), float(df["Close"].iloc[-1])
        results.append({"ticker":ticker,"total_return_pct":round((end-start)/start*100,2),
            "volatility":round(calc_volatility(returns),2),"sharpe":round(calc_sharpe(returns),2),
            "var_95":round(calc_var(returns,0.95)*100,2),"beta":round(beta,2),
            "start_price":round(start,2),"end_price":round(end,2)})
    return {"comparisons":results,"period":period,"benchmark":"SPY"}

@router.get("/{ticker}")
async def stock_detail(ticker: str, period: str = "1y"):
    info = get_company_info(ticker.upper())
    df = get_history(ticker.upper(), period)
    if df.empty: return {**info,"error":"No price history"}
    returns = calc_returns(df["Close"])
    prices = df["Close"]
    current = float(prices.iloc[-1])
    sma_20 = float(prices.rolling(20).mean().iloc[-1]) if len(prices)>=20 else None
    sma_50 = float(prices.rolling(50).mean().iloc[-1]) if len(prices)>=50 else None
    sma_200 = float(prices.rolling(200).mean().iloc[-1]) if len(prices)>=200 else None
    delta = prices.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain/loss
    rsi = float(100-(100/(1+rs.iloc[-1]))) if loss.iloc[-1]!=0 else 50
    signal = "BUY" if (sma_50 and current>sma_50 and rsi<70) else "SELL" if (sma_50 and current<sma_50 and rsi>30) else "HOLD"
    spy_df = get_history("SPY", period)
    beta = calc_beta(returns, calc_returns(spy_df["Close"])) if not spy_df.empty else 1.0
    return {**info,"current_price":round(current,2),"sma_20":round(sma_20,2) if sma_20 else None,
        "sma_50":round(sma_50,2) if sma_50 else None,"sma_200":round(sma_200,2) if sma_200 else None,
        "rsi":round(rsi,1),"signal":signal,"var_95":round(calc_var(returns,0.95)*100,2),
        "sharpe":round(calc_sharpe(returns),2),"volatility":round(calc_volatility(returns),2),"beta":round(beta,2)}
