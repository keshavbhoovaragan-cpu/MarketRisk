import yfinance as yf
import pandas as pd
import time, logging
import os
from typing import Dict, List, Optional
from app.services.database import get_db
logger = logging.getLogger(__name__)
CACHE_TTL = max(30, int(os.getenv("MARKET_CACHE_TTL_SECONDS", "60")))
QUOTE_SOURCE = "Yahoo Finance via yfinance"


def _quote_response(data: Dict, fetched_at: int) -> Dict:
    quote_as_of = data.get("quote_as_of")
    quote_age = max(0, int(time.time()) - int(quote_as_of)) if quote_as_of else None
    return {
        **data,
        "source": data.get("provider") or QUOTE_SOURCE,
        "quote_as_of": quote_as_of,
        "fetched_at": fetched_at,
        "cache_ttl_seconds": CACHE_TTL,
        "quote_age_seconds": quote_age,
        "realtime_guaranteed": False,
    }

def get_price(ticker: str) -> Optional[Dict]:
    conn = get_db()
    cached = conn.execute("SELECT * FROM price_cache WHERE ticker=? AND updated_at > ?", (ticker, int(time.time())-CACHE_TTL)).fetchone()
    conn.close()
    if cached: return _quote_response(dict(cached), int(cached["updated_at"]))
    try:
        t = yf.Ticker(ticker)
        info = t.info
        hist = t.history(period="1d", interval="1m")
        if hist.empty:
            hist = t.history(period="2d")
        if hist.empty: return None
        price = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist)>1 else price
        change_pct = ((price-prev)/prev*100) if prev else 0
        bar_index = hist.index[-1]
        quote_as_of = int(bar_index.timestamp()) if hasattr(bar_index, "timestamp") else int(time.time())
        fetched_at = int(time.time())
        data = {"ticker":ticker,"price":round(price,2),"change_pct":round(change_pct,2),
                "volume":int(info.get("volume",0) or 0),"market_cap":info.get("marketCap",0) or 0,
                "pe_ratio":info.get("trailingPE",None),"week52_high":info.get("fiftyTwoWeekHigh",None),
                "week52_low":info.get("fiftyTwoWeekLow",None),"updated_at":fetched_at,
                "quote_as_of":quote_as_of,"provider":QUOTE_SOURCE}
        conn = get_db()
        conn.execute("INSERT OR REPLACE INTO price_cache (ticker,price,change_pct,volume,market_cap,pe_ratio,week52_high,week52_low,updated_at,quote_as_of,provider) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (data["ticker"],data["price"],data["change_pct"],data["volume"],data["market_cap"],data.get("pe_ratio"),data.get("week52_high"),data.get("week52_low"),data["updated_at"],data["quote_as_of"],data["provider"]))
        conn.commit(); conn.close()
        return _quote_response(data, fetched_at)
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
