# MarketRisk

MarketRisk is a full-stack financial risk analytics dashboard with a distributed Spark batch path for portfolio risk calculations. The web application remains a request-driven service, while PySpark handles batch processing over historical market data and writes Parquet results to object storage.

## Stack

- Frontend: Next.js 14 + TypeScript
- Backend: FastAPI + Python
- Data: SQLite for the current API, yfinance for the learning/demo feed, and MinIO/S3A Parquet for Spark batch input/output
- Risk math: VaR, CVaR, Sharpe, Sortino, Beta, Monte Carlo, max drawdown
- Platform: Docker Compose, k3d/Kubernetes, Spark Operator, and ArgoCD GitOps

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
- Frontend: http://localhost:3002
- Backend API: http://localhost:8002
- Swagger docs: http://localhost:8002/docs

## Free deployment

### Render (free tier)

1. Push this repo to GitHub.
2. Create a new Render Web Service from this repository.
3. Set the root directory to `backend`.
4. Use the included `render.yaml` config or set:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. After deployment, set the frontend env variable:
   - `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`
6. Redeploy the frontend.

## Features

- Authenticated accounts with private portfolios and per-user watchlists
- Multiple paper portfolios with virtual starting cash, simulated buy/sell orders, and an immutable trade ledger
- Portfolio dashboard with holdings, cash, realized/unrealized context, quote provenance, and risk snapshots
- Market workspace with personal watchlist, movers, screener, comparisons, and stock details
- Beginner, intermediate, and advanced investing/risk lessons
- Explainable portfolio coach; optional OpenAI-compatible educational enrichment when `OPENAI_API_KEY` is configured
- Stress testing and VaR/CVaR analysis
- Correlation matrix and risk history snapshots
- Stock screener and equity comparison views

## Paper investing and quote quality

Create an account at `/login`. New accounts receive a private paper portfolio with $100,000 virtual cash. Create additional portfolios, submit simulated market-price buys/sells, review the trade ledger, manage a personal watchlist, and choose a learning level/risk profile. Orders never reach a brokerage or exchange.

Quotes currently come from Yahoo Finance through `yfinance`. The API refreshes its local quote cache every 60 seconds by default (`MARKET_CACHE_TTL_SECONDS` can override this), and returns both the provider bar timestamp and local retrieval time. This is **not a guaranteed real-time feed**; data can be delayed, stale outside market hours, rate-limited, or unavailable. Missing prices make marked equity explicitly incomplete rather than silently treating the holding as worth zero. For reliable minute-level or exchange-licensed data, configure a commercial provider with an appropriate entitlement.

The portfolio coach always provides deterministic, explainable observations. To enable optional LLM-generated educational explanations, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the backend environment. The key stays server-side; the coach receives portfolio metrics without account email and is prompted not to make trade instructions or invent market facts. Without a configured key it reports that generative AI is disconnected and uses only the explainable rules. Coach output is educational, not personal financial advice.

Authentication uses salted PBKDF2 password hashes and revocable server-side sessions in an HttpOnly cookie. Set `SESSION_SECRET` to a stable secret in deployed environments and set `SESSION_COOKIE_SECURE=true` behind HTTPS. Configure `CORS_ORIGINS` to the exact frontend origins; the local default is `http://localhost:3002,http://127.0.0.1:3002`.

Run the backend integration suite in an environment with backend requirements installed:

```bash
cd backend
python -m unittest discover -s tests -v
```

## Local Spark risk batch (Phase 1)

The standalone PySpark batch job leaves the current FastAPI/SQLite request path unchanged. It accepts `yfinance`, normalized CSV, or Parquet input and writes raw prices and risk outputs to local Parquet directories. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design reasoning and [docs/LEARNING.md](docs/LEARNING.md) for the phase-by-phase learning log.

Prerequisites are Java 17+ and the dependencies in `backend/spark_jobs/requirements.txt` installed in the Python environment used by `spark-submit`. From the repository root, a modest real-data pilot is:

```bash
spark-submit backend/spark_jobs/risk_batch.py \
   --source yfinance \
   --tickers AAPL,MSFT,NVDA \
   --period 5y \
   --holdings backend/spark_jobs/example_holdings.csv
```

The default yfinance source is intended for a small pilot, not dependable bulk ingestion for thousands of symbols. For large repeatable runs, provide normalized CSV/Parquet from a configurable market-data provider. Local runs write Parquet, and the k3d Spark driver/executor path has also completed a run writing Parquet to MinIO over S3A. Loading Spark results into PostgreSQL is not implemented yet.

## Containerized local development (Phase 2)

Start Docker Desktop, then run from the repository root:

```bash
docker compose up --build -d
```

The frontend is at http://localhost:3002 and the FastAPI health endpoint is http://localhost:8002/api/health. SQLite is kept in a named Docker volume so API container rebuilds do not discard portfolio data. To run the separate Spark job image with its sample yfinance configuration:

```bash
docker compose --profile batch run --rm spark-job
```

Spark Parquet outputs are written under `data/spark/` on the host. Stop the services with `docker compose down`; this keeps the SQLite volume. `docker compose down -v` also deletes that local database volume.

## Kubernetes and GitOps (Phases 3-4)

Development manifests under `infra/k8s/dev` deploy the API, frontend, MinIO, and Spark Operator workloads. A manual SparkApplication has completed in k3d with an executor and MinIO-backed Parquet output. The sample nightly schedule is suspended until the demo MinIO credentials are managed consistently across pod restarts.

ArgoCD is installed in the local k3d cluster. Its root app watches `infra/gitops/apps`, which defines the dev app and a manually gated production child app. The production overlay is a template, not a production-ready deployment: PostgreSQL migration, production credentials, verified GHCR images, ingress/TLS, and operational policies remain prerequisites.

The GHCR workflow is in `.github/workflows/build-and-push-ghcr.yml`. A successful run built and published the backend, frontend, and Spark images and committed immutable tags to the dev manifests. The local repository should be fast-forwarded to include the workflow-generated manifest-tag commit before making further release commits.

## Current limitations

- The API still uses SQLite; PostgreSQL persistence and Spark-result ingestion remain future work.
- Paper portfolios are supported; real-money broker connections and order execution are not implemented.
- Yahoo/yfinance is a learning/demo feed without a real-time service guarantee.
- The AI coach uses transparent rules unless an `OPENAI_API_KEY` is configured; no AI key is included in the repository.
- The scheduled sample Spark job is suspended until credential management and repeatable input handling are in place.
- A repeatable benchmark harness and performance comparison are not implemented yet.
