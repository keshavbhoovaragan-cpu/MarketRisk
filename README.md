# MarketRisk

MarketRisk is a full-stack financial risk analytics dashboard focused on portfolio monitoring, market data, and risk modeling.

## Stack

- Frontend: Next.js 14 + TypeScript
- Backend: FastAPI + Python
- Data: SQLite + yfinance
- Risk math: VaR, CVaR, Sharpe, Sortino, Beta, Monte Carlo, max drawdown

## Project structure

- backend/ - FastAPI application and SQLite-backed services
- frontend/ - Next.js dashboard UI
- data/ - runtime database directory (created automatically)

## Local setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:8001
- Swagger docs: http://localhost:8001/docs

## Features

- Portfolio dashboard with holdings and P&L
- Stress testing and VaR/CVaR analysis
- Correlation matrix and risk history snapshots
- Stock screener and equity comparison views
- Live market ticker and active movers

## Notes

This project was initialized locally and is now ready for Git-based versioning and real commits.
