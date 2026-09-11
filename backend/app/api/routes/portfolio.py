from fastapi import APIRouter
from pydantic import BaseModel
from app.services.database import get_db
from app.services.market import get_prices_bulk
import time

router = APIRouter()

class HoldingAdd(BaseModel):
    ticker: str
    shares: float
    avg_cost: float

@router.get("/")
async def get_portfolio():
    conn = get_db()
    holdings = conn.execute("SELECT * FROM holdings WHERE portfolio_id=1 ORDER BY ticker").fetchall()
    conn.close()
    if not holdings: return {"holdings":[],"total_value":0,"total_cost":0,"total_pnl":0,"total_pnl_pct":0,"num_holdings":0}
    tickers = [h["ticker"] for h in holdings]
    prices = get_prices_bulk(tickers)
    result = []
    total_value = total_cost = 0
    for h in holdings:
        t = h["ticker"]
        pd = prices.get(t, {})
        current = pd.get("price", h["avg_cost"])
        mv = h["shares"] * current
        cb = h["shares"] * h["avg_cost"]
        pnl = mv - cb
        total_value += mv; total_cost += cb
        result.append({"ticker":t,"shares":h["shares"],"avg_cost":h["avg_cost"],"current_price":round(current,2),
            "market_value":round(mv,2),"cost_basis":round(cb,2),"pnl":round(pnl,2),
            "pnl_pct":round((current-h["avg_cost"])/h["avg_cost"]*100,2) if h["avg_cost"] else 0,
            "change_pct":pd.get("change_pct",0),"weight":0})
    for r in result: r["weight"] = round(r["market_value"]/total_value*100,1) if total_value else 0
    result.sort(key=lambda x: x["market_value"], reverse=True)
    total_pnl = total_value - total_cost
    return {"holdings":result,"total_value":round(total_value,2),"total_cost":round(total_cost,2),
            "total_pnl":round(total_pnl,2),"total_pnl_pct":round(total_pnl/total_cost*100,2) if total_cost else 0,"num_holdings":len(result)}

@router.post("/holdings")
async def add_holding(body: HoldingAdd):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO holdings (portfolio_id,ticker,shares,avg_cost,added_at) VALUES (1,?,?,?,?)", (body.ticker.upper(),body.shares,body.avg_cost,int(time.time())))
    conn.commit(); conn.close()
    return {"success":True,"ticker":body.ticker.upper()}

@router.delete("/holdings/{ticker}")
async def remove_holding(ticker: str):
    conn = get_db()
    conn.execute("DELETE FROM holdings WHERE portfolio_id=1 AND ticker=?", (ticker.upper(),))
    conn.commit(); conn.close()
    return {"success":True}

@router.get("/watchlist")
async def get_watchlist():
    conn = get_db()
    items = conn.execute("SELECT ticker FROM watchlist ORDER BY ticker").fetchall()
    conn.close()
    tickers = [i["ticker"] for i in items]
    prices = get_prices_bulk(tickers)
    return {"watchlist":[prices.get(t,{"ticker":t}) for t in tickers]}
