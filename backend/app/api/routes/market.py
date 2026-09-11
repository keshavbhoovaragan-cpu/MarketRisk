from fastapi import APIRouter, HTTPException
from app.services.market import get_price, get_history, get_company_info, search_tickers, get_prices_bulk

router = APIRouter()

@router.get("/overview")
async def overview():
    tracked = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "META", "BTC-USD", "ETH-USD", "GLD"]
    prices = get_prices_bulk(tracked)
    items = sorted(prices.values(), key=lambda x: x.get("change_pct", 0), reverse=True)
    spy = prices.get("SPY", {})
    return {
        "market_summary": {
            "index": "SPY",
            "index_price": spy.get("price"),
            "index_change_pct": spy.get("change_pct"),
            "market_mode": "risk-on" if (spy.get("change_pct") or 0) >= 0 else "defensive",
            "tracked_symbols": len(prices),
        },
        "gainers": items[:5],
        "losers": sorted(items, key=lambda x: x.get("change_pct", 0))[:5],
        "most_active": sorted(prices.values(), key=lambda x: x.get("volume", 0), reverse=True)[:5],
    }

@router.get("/search")
async def search(q: str):
    return {"results": search_tickers(q)}

@router.get("/price/{ticker}")
async def price(ticker: str):
    data = get_price(ticker.upper())
    if not data: raise HTTPException(404, f"Could not fetch price for {ticker}")
    return data

@router.get("/prices")
async def prices(tickers: str):
    return get_prices_bulk([t.strip().upper() for t in tickers.split(",") if t.strip()])

@router.get("/history/{ticker}")
async def history(ticker: str, period: str = "1y"):
    df = get_history(ticker.upper(), period)
    if df.empty: raise HTTPException(404, f"No history for {ticker}")
    result = [{"date":str(idx)[:10],"open":round(float(row["Open"]),2),"high":round(float(row["High"]),2),
               "low":round(float(row["Low"]),2),"close":round(float(row["Close"]),2),"volume":int(row["Volume"])}
              for idx,row in df.iterrows()]
    return {"ticker":ticker.upper(),"period":period,"data":result}

@router.get("/info/{ticker}")
async def info(ticker: str):
    return get_company_info(ticker.upper())

@router.get("/movers")
async def movers():
    TRACKED = ["AAPL","MSFT","GOOGL","NVDA","TSLA","AMZN","META","JPM","V","NFLX","AMD","INTC","SPY","QQQ","BTC-USD"]
    items = list(get_prices_bulk(TRACKED).values())
    items.sort(key=lambda x: x.get("change_pct",0), reverse=True)
    return {"gainers":items[:5],"losers":sorted(items,key=lambda x: x.get("change_pct",0))[:5],"most_active":sorted(items,key=lambda x: x.get("volume",0),reverse=True)[:5]}
