import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import portfolio, market, risk, stocks
from app.services.database import init_db

PORT = int(os.getenv("PORT", "8002"))

app = FastAPI(title="MarketRisk API", version="1.0.0",
    description="Financial Risk Analytics — VaR, Sharpe, Beta, Monte Carlo")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    init_db()

app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(market.router,    prefix="/api/market",    tags=["market"])
app.include_router(risk.router,      prefix="/api/risk",      tags=["risk"])
app.include_router(stocks.router,    prefix="/api/stocks",    tags=["stocks"])

@app.get("/api/health")
async def health():
    from app.services.database import get_db
    conn = get_db()
    h = conn.execute("SELECT COUNT(*) FROM holdings WHERE portfolio_id=1").fetchone()[0]
    conn.close()
    return {"status":"ok","version":"1.0.0","holdings":h,"stack":["FastAPI","Python","yfinance","NumPy","SQLite"]}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=False)
