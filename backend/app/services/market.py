import yfinance as yf
import pandas as pd
import time, logging
from typing import Dict, List, Optional
from app.services.database import get_db
logger = logging.getLogger(__name__)
CACHE_TTL = 300

def get_price(ticker: str) -> Optional[Dict]:
    conn = get_db()
    cached = conn.execute("SELECT * FROM price_cache WHERE ticker=? AND updated_at > ?", (ticker, int(time.time())-CACHE_TTL)).fetchone()
    conn.close()
    if cached: return dict(cached)
    try:
        t = yf.Ticker(ticker)
        info = t.info
        hist = t.history(period="2d")
        if hist.empty: return None
        price = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist)>1 else price
        change_pct = ((price-prev)/prev*100) if prev else 0
        data = {"ticker":ticker,"price":round(price,2),"change_pct":round(change_pct,2),
                "volume":int(info.get("volume",0) or 0),"market_cap":info.get("marketCap",0) or 0,
                "pe_ratio":info.get("trailingPE",None),"week52_high":info.get("fiftyTwoWeekHigh",None),
                "week52_low":info.get("fiftyTwoWeekLow",None),"updated_at":int(time.time())}
        conn = get_db()
        conn.execute("INSERT OR REPLACE INTO price_cache (ticker,price,change_pct,volume,market_cap,pe_ratio,week52_high,week52_low,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (data["ticker"],data["price"],data["change_pct"],data["volume"],data["market_cap"],data.get("pe_ratio"),data.get("week52_high"),data.get("week52_low"),data["updated_at"]))
        conn.commit(); conn.close()
        return data
    except Exception as e:
        logger.warning(f"Price fetch failed for {ticker}: {e}")
        return None

def get_history(ticker: str, period: str = "1y") -> pd.DataFrame:
    try: return yf.Ticker(ticker).history(period=period)
    except: return pd.DataFrame()

def get_prices_bulk(tickers: List[str]) -> Dict:
    return {t: d for t in tickers if (d := get_price(t))}

def get_company_info(ticker: str) -> Dict:
    try:
        info = yf.Ticker(ticker).info
        return {"ticker":ticker,"name":info.get("longName",ticker),"sector":info.get("sector","Unknown"),
                "industry":info.get("industry","Unknown"),"description":(info.get("longBusinessSummary","") or "")[:300],
                "pe_ratio":info.get("trailingPE"),"forward_pe":info.get("forwardPE"),
                "price_to_book":info.get("priceToBook"),"dividend_yield":info.get("dividendYield"),
                "beta":info.get("beta"),"market_cap":info.get("marketCap",0),
                "52w_high":info.get("fiftyTwoWeekHigh"),"52w_low":info.get("fiftyTwoWeekLow"),
                "avg_volume":info.get("averageVolume"),"recommendation":info.get("recommendationKey","")}
    except Exception as e: return {"ticker":ticker,"name":ticker,"error":str(e)}

def search_tickers(query: str) -> List[Dict]:
    COMMON = {"apple":"AAPL","microsoft":"MSFT","google":"GOOGL","alphabet":"GOOGL","amazon":"AMZN",
              "tesla":"TSLA","nvidia":"NVDA","meta":"META","netflix":"NFLX","berkshire":"BRK-B",
              "jpmorgan":"JPM","visa":"V","mastercard":"MA","paypal":"PYPL","bitcoin":"BTC-USD",
              "ethereum":"ETH-USD","gold":"GLD","intel":"INTC","amd":"AMD","salesforce":"CRM",
              "adobe":"ADBE","disney":"DIS","walmart":"WMT","pfizer":"PFE","uber":"UBER",
              "airbnb":"ABNB","snowflake":"SNOW","palantir":"PLTR","coinbase":"COIN","shopify":"SHOP"}
    q = query.lower().strip()
    results = []
    if len(q)<=5 and q.upper().replace("-","").isalpha():
        results.append({"ticker":q.upper(),"name":q.upper(),"type":"ticker"})
    for name,ticker in COMMON.items():
        if q in name or name in q:
            results.append({"ticker":ticker,"name":name.title(),"type":"company"})
    return results[:8]
