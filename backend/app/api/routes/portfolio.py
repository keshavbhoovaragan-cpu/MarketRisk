import math
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.services.auth import get_current_user
from app.services.coach import add_ai_coaching
from app.services.database import get_db
from app.services.market import CACHE_TTL, get_prices_bulk

router = APIRouter()
TICKER_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.-]{0,14}$")


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    starting_cash: float = Field(default=100_000, ge=1_000, le=10_000_000)


class PaperTrade(BaseModel):
    ticker: str = Field(min_length=1, max_length=15)
    side: str
    shares: float = Field(gt=0, le=1_000_000)


def _owned_portfolio(conn, user_id: int, portfolio_id: Optional[int]):
    if portfolio_id is None:
        row = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ? ORDER BY id LIMIT 1", (user_id,)
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM portfolios WHERE id = ? AND user_id = ?", (portfolio_id, user_id)
        ).fetchone()
    return row


def _portfolio_summary(portfolio, holdings, prices):
    positions = []
    holdings_value = 0.0
    cost_basis = 0.0
    missing_quotes = []
    for holding in holdings:
        quote = prices.get(holding["ticker"])
        current_price = float(quote["price"]) if quote and quote.get("price") is not None else None
        market_value = current_price * holding["shares"] if current_price is not None else None
        if market_value is not None:
            holdings_value += market_value
        else:
            missing_quotes.append(holding["ticker"])
        position_cost = holding["avg_cost"] * holding["shares"]
        cost_basis += position_cost
        positions.append({
            "ticker": holding["ticker"],
            "shares": holding["shares"],
            "avg_cost": round(holding["avg_cost"], 4),
            "current_price": round(current_price, 4) if current_price is not None else None,
            "market_value": round(market_value, 2) if market_value is not None else None,
            "cost_basis": round(position_cost, 2),
            "pnl": round(market_value - position_cost, 2) if market_value is not None else None,
            "pnl_pct": round((current_price / holding["avg_cost"] - 1) * 100, 2)
            if current_price is not None and holding["avg_cost"] else None,
            "change_pct": quote.get("change_pct") if quote else None,
            "weight": 0.0,
            "quote_as_of": quote.get("updated_at") if quote else None,
            "quote_source": quote.get("source", "Yahoo Finance via yfinance") if quote else None,
        })

    valuation_complete = not missing_quotes
    equity = float(portfolio["cash_balance"]) + holdings_value if valuation_complete else None
    for position in positions:
        position["weight"] = round(position["market_value"] / equity * 100, 2) if equity and position["market_value"] is not None else None
    positions.sort(key=lambda item: item["market_value"] if item["market_value"] is not None else -1, reverse=True)
    total_return = equity - float(portfolio["starting_cash"]) if equity is not None else None
    return {
        "portfolio": {
            "id": portfolio["id"],
            "name": portfolio["name"],
            "is_paper": bool(portfolio["is_paper"]),
            "starting_cash": round(float(portfolio["starting_cash"]), 2),
            "cash_balance": round(float(portfolio["cash_balance"]), 2),
        },
        "holdings": positions,
        "valuation_complete": valuation_complete,
        "missing_quote_tickers": missing_quotes,
        "total_value": round(equity, 2) if equity is not None else None,
        "invested_value": round(holdings_value, 2) if valuation_complete else None,
        "total_cost": round(cost_basis, 2),
        "total_pnl": round(holdings_value - cost_basis, 2) if valuation_complete else None,
        "total_return": round(total_return, 2) if total_return is not None else None,
        "total_pnl_pct": round(total_return / portfolio["starting_cash"] * 100, 2)
        if total_return is not None and portfolio["starting_cash"] else None,
        "num_holdings": len(positions),
        "market_data": {
            "provider": "Yahoo Finance via yfinance",
            "realtime_guaranteed": False,
            "cache_ttl_seconds": CACHE_TTL,
            "notice": "Quotes may be delayed or unavailable. Each position includes the provider update timestamp when available.",
        },
    }


@router.get("/list")
async def list_portfolios(user: dict = Depends(get_current_user)):
    conn = get_db()
    portfolios = conn.execute(
        "SELECT id, name, is_paper, cash_balance, starting_cash, created_at "
        "FROM portfolios WHERE user_id = ? ORDER BY id",
        (user["id"],),
    ).fetchall()
    conn.close()
    return {"portfolios": [dict(row) for row in portfolios]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_portfolio(body: PortfolioCreate, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Portfolio name cannot be blank")
    now = int(time.time())
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO portfolios (name, created_at, user_id, cash_balance, starting_cash, is_paper) "
        "VALUES (?, ?, ?, ?, ?, 1)",
        (name, now, user["id"], body.starting_cash, body.starting_cash),
    )
    portfolio_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": portfolio_id, "name": name, "is_paper": True, "cash_balance": body.starting_cash}


@router.get("/")
async def get_portfolio(portfolio_id: Optional[int] = None, user: dict = Depends(get_current_user)):
    conn = get_db()
    portfolio = _owned_portfolio(conn, user["id"], portfolio_id)
    if portfolio is None:
        conn.close()
        if portfolio_id is not None:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return {"portfolios": [], "holdings": [], "total_value": 0, "total_pnl": 0, "num_holdings": 0}
    holdings = conn.execute(
        "SELECT ticker, shares, avg_cost FROM holdings WHERE portfolio_id = ? ORDER BY ticker",
        (portfolio["id"],),
    ).fetchall()
    conn.close()
    prices = get_prices_bulk([row["ticker"] for row in holdings]) if holdings else {}
    return _portfolio_summary(portfolio, holdings, prices)


@router.get("/{portfolio_id}/trades")
async def list_trades(portfolio_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    portfolio = _owned_portfolio(conn, user["id"], portfolio_id)
    if portfolio is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Portfolio not found")
    trades = conn.execute(
        "SELECT id, ticker, side, shares, price, fees, executed_at, quote_source, quote_as_of "
        "FROM trades WHERE portfolio_id = ? ORDER BY executed_at DESC, id DESC LIMIT 200",
        (portfolio_id,),
    ).fetchall()
    conn.close()
    return {"trades": [dict(row) for row in trades]}


@router.get("/{portfolio_id}/coach")
async def portfolio_coach(portfolio_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    portfolio = _owned_portfolio(conn, user["id"], portfolio_id)
    if portfolio is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Portfolio not found")
    holdings = conn.execute(
        "SELECT ticker, shares, avg_cost FROM holdings WHERE portfolio_id = ?", (portfolio_id,)
    ).fetchall()
    preferences = conn.execute(
        "SELECT experience_level, risk_tolerance, investment_horizon FROM user_preferences WHERE user_id = ?",
        (user["id"],),
    ).fetchone()
    conn.close()

    prices = get_prices_bulk([row["ticker"] for row in holdings]) if holdings else {}
    summary = _portfolio_summary(portfolio, holdings, prices)
    positions = summary["holdings"]
    level = preferences["experience_level"] if preferences else "beginner"
    insights = []

    if not positions:
        insights.append({
            "kind": "learning",
            "title": "Start by learning the order flow",
            "detail": "This portfolio has no positions. Use a small hypothetical paper order to see how shares, quote timestamps, and virtual cash interact.",
            "metric": "No holdings",
        })

    if positions:
        largest = positions[0]
        if largest["weight"] >= 20:
            insights.append({
                "kind": "concentration",
                "title": "Review single-position concentration",
                "detail": f"{largest['ticker']} represents {largest['weight']:.1f}% of marked portfolio equity. Concentration can increase the effect of company-specific price moves; compare this exposure with your stated horizon and tolerance.",
                "metric": f"{largest['weight']:.1f}% in {largest['ticker']}",
            })
        else:
            insights.append({
                "kind": "allocation",
                "title": "Check how holdings move together",
                "detail": "Position count alone does not measure diversification. Review sector and correlation exposure before concluding the portfolio is diversified.",
                "metric": f"{len(positions)} positions",
            })

        unavailable = [item["ticker"] for item in positions if item["current_price"] is None]
        if unavailable:
            insights.append({
                "kind": "data_quality",
                "title": "Some position quotes are unavailable",
                "detail": f"Marked equity excludes unpriced value for: {', '.join(unavailable)}. Do not treat the displayed total as complete until quotes are available.",
                "metric": f"{len(unavailable)} missing quotes",
            })
        else:
            now = int(time.time())
            old_quotes = [item["ticker"] for item in positions if item["quote_as_of"] and now - item["quote_as_of"] > 900]
            if old_quotes:
                insights.append({
                    "kind": "data_quality",
                    "title": "Verify quote timestamps",
                    "detail": f"The latest returned provider bars for {', '.join(old_quotes)} are more than 15 minutes old. This may happen outside trading hours or during provider delays.",
                    "metric": "Quote may be stale",
                })

        if summary["valuation_complete"] and summary["total_value"]:
            cash_weight = summary["portfolio"]["cash_balance"] / summary["total_value"] * 100
            insights.append({
                "kind": "cash",
                "title": "Understand your cash allocation",
                "detail": f"Virtual cash is {cash_weight:.1f}% of marked equity. Cash can reduce exposure to market moves, but the appropriate level depends on your goals and is not determined by this tool.",
                "metric": f"{cash_weight:.1f}% cash",
            })

    lessons = {
        "beginner": "Beginner: learn market orders, share quantity, diversification, and why a displayed quote can differ from an execution price.",
        "intermediate": "Intermediate: compare concentration, correlation, volatility, and drawdown across scenarios rather than focusing on return alone.",
        "advanced": "Advanced: examine factor concentration, tail-risk assumptions, liquidity, and sensitivity to the selected historical window.",
    }
    coaching = await add_ai_coaching(
        summary,
        dict(preferences) if preferences else {},
        lessons.get(level, lessons["beginner"]),
        insights,
    )
    return {
        "portfolio_id": portfolio_id,
        "mode": "ai_educator" if coaching["generative_ai_connected"] else "explainable_rules",
        "generative_ai_connected": coaching["generative_ai_connected"],
        "ai_model": coaching.get("ai_model"),
        "preferences": dict(preferences) if preferences else {
            "experience_level": "beginner", "risk_tolerance": "moderate", "investment_horizon": "long_term"
        },
        "lesson": coaching["lesson"],
        "insights": coaching["insights"],
        "disclaimer": "Educational observations, not individualized financial advice or a recommendation to buy or sell securities. No generative AI provider is configured.",
    }


@router.post("/{portfolio_id}/trades", status_code=status.HTTP_201_CREATED)
async def create_paper_trade(
    portfolio_id: int, body: PaperTrade, user: dict = Depends(get_current_user)
):
    ticker = body.ticker.strip().upper()
    side = body.side.strip().upper()
    if not TICKER_PATTERN.fullmatch(ticker):
        raise HTTPException(status_code=422, detail="Enter a valid market ticker")
    if side not in {"BUY", "SELL"}:
        raise HTTPException(status_code=422, detail="Trade side must be BUY or SELL")
    if not math.isfinite(body.shares):
        raise HTTPException(status_code=422, detail="Share quantity must be finite")

    quote = get_prices_bulk([ticker]).get(ticker)
    if not quote or quote.get("price") is None:
        raise HTTPException(status_code=424, detail=f"No current quote is available for {ticker}")
    price = float(quote["price"])
    if not math.isfinite(price) or price <= 0:
        raise HTTPException(status_code=424, detail=f"The quote for {ticker} is invalid")
    source = quote.get("source", "Yahoo Finance via yfinance")
    quote_as_of = int(quote.get("quote_as_of") or quote.get("updated_at", time.time()))
    now = int(time.time())

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        portfolio = _owned_portfolio(conn, user["id"], portfolio_id)
        if portfolio is None:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        holding = conn.execute(
            "SELECT id, shares, avg_cost FROM holdings WHERE portfolio_id = ? AND ticker = ?",
            (portfolio_id, ticker),
        ).fetchone()
        notional = price * body.shares
        fees = 0.0
        cash = float(portfolio["cash_balance"])

        if side == "BUY":
            if notional + fees > cash:
                raise HTTPException(status_code=409, detail="Insufficient paper cash for this order")
            new_shares = body.shares + (holding["shares"] if holding else 0.0)
            new_cost = ((body.shares * price) + (holding["shares"] * holding["avg_cost"]) if holding else notional) / new_shares
            if holding:
                conn.execute(
                    "UPDATE holdings SET shares = ?, avg_cost = ?, added_at = ? WHERE id = ?",
                    (new_shares, new_cost, now, holding["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO holdings (portfolio_id, ticker, shares, avg_cost, added_at) VALUES (?, ?, ?, ?, ?)",
                    (portfolio_id, ticker, body.shares, price, now),
                )
            new_cash = cash - notional - fees
        else:
            if holding is None or holding["shares"] < body.shares:
                raise HTTPException(status_code=409, detail="Not enough shares in this portfolio to sell")
            remaining = holding["shares"] - body.shares
            if remaining <= 1e-10:
                conn.execute("DELETE FROM holdings WHERE id = ?", (holding["id"],))
            else:
                conn.execute("UPDATE holdings SET shares = ?, added_at = ? WHERE id = ?", (remaining, now, holding["id"]))
            new_cash = cash + notional - fees

        conn.execute("UPDATE portfolios SET cash_balance = ? WHERE id = ?", (new_cash, portfolio_id))
        cursor = conn.execute(
            "INSERT INTO trades (portfolio_id, ticker, side, shares, price, fees, executed_at, quote_source, quote_as_of) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (portfolio_id, ticker, side, body.shares, price, fees, now, source, quote_as_of),
        )
        trade_id = cursor.lastrowid
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "trade": {
            "id": trade_id,
            "portfolio_id": portfolio_id,
            "ticker": ticker,
            "side": side,
            "shares": body.shares,
            "price": price,
            "fees": fees,
            "executed_at": now,
            "quote_source": source,
            "quote_as_of": quote_as_of,
            "is_paper": True,
        },
        "cash_balance": round(new_cash, 2),
    }


@router.get("/watchlist")
async def get_watchlist(user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT ticker FROM user_watchlist WHERE user_id = ? ORDER BY ticker", (user["id"],)
    ).fetchall()
    conn.close()
    tickers = [row["ticker"] for row in rows]
    prices = get_prices_bulk(tickers) if tickers else {}
    return {"watchlist": [prices.get(ticker, {
        "ticker": ticker,
        "price": None,
        "change_pct": None,
        "source": "Yahoo Finance via yfinance",
        "quote_as_of": None,
        "realtime_guaranteed": False,
        "quote_status": "unavailable",
    }) for ticker in tickers]}


@router.post("/watchlist/{ticker}", status_code=status.HTTP_201_CREATED)
async def add_watchlist_ticker(ticker: str, user: dict = Depends(get_current_user)):
    ticker = ticker.strip().upper()
    if not TICKER_PATTERN.fullmatch(ticker):
        raise HTTPException(status_code=422, detail="Enter a valid market ticker")
    now = int(time.time())
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO user_watchlist (user_id, ticker, added_at) VALUES (?, ?, ?)",
        (user["id"], ticker, now),
    )
    conn.commit()
    conn.close()
    return {"success": True, "ticker": ticker}


@router.delete("/watchlist/{ticker}")
async def remove_watchlist_ticker(ticker: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute(
        "DELETE FROM user_watchlist WHERE user_id = ? AND ticker = ?",
        (user["id"], ticker.upper()),
    )
    conn.commit()
    conn.close()
    return {"success": True}
