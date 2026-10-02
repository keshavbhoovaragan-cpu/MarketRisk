"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/nav/NavBar";
import {
  createPaperTrade,
  createPortfolio,
  getMarketPrice,
  getLearningPreferences,
  getPortfolio,
  getPortfolioCoach,
  getPortfolios,
  getTrades,
  logout,
  saveLearningPreferences,
} from "@/lib/api";

type PortfolioOption = { id: number; name: string; cash_balance: number; starting_cash: number; is_paper: number };
type Holding = {
  ticker: string;
  shares: number;
  avg_cost: number;
  current_price: number | null;
  market_value: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  weight: number;
  quote_as_of: number | null;
  quote_source: string | null;
};
type Summary = {
  portfolio: { id: number; name: string; cash_balance: number; starting_cash: number; is_paper: boolean };
  holdings: Holding[];
  total_value: number;
  invested_value: number;
  total_pnl: number;
  total_return: number | null;
  total_pnl_pct: number | null;
  valuation_complete: boolean;
  missing_quote_tickers: string[];
  market_data: { provider: string; realtime_guaranteed: boolean; cache_ttl_seconds: number; notice: string };
};
type Trade = { id: number; ticker: string; side: "BUY" | "SELL"; shares: number; price: number; fees: number; executed_at: number; quote_source: string; quote_as_of: number };

const cash = (value: number | null | undefined) => value === null || value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const timestamp = (value: number | null) => value ? new Date(value * 1000).toLocaleString() : "Provider timestamp unavailable";

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<PortfolioOption[]>([]);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [coach, setCoach] = useState<any>(null);
  const [preferences, setPreferences] = useState({ experience_level: "beginner", risk_tolerance: "moderate", investment_horizon: "long_term" });
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quote, setQuote] = useState<any>(null);
  const [newName, setNewName] = useState("");
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPortfolios().then((result: { portfolios: PortfolioOption[] }) => {
      setPortfolios(result.portfolios);
      setPortfolioId(result.portfolios[0]?.id ?? null);
    }).catch(() => setError("Could not load your portfolios."));
    getLearningPreferences().then(result => setPreferences(result.preferences)).catch(() => {});
  }, []);

  useEffect(() => {
    if (portfolioId === null) return;
    let active = true;
    const refresh = () => {
      Promise.all([getPortfolio(portfolioId), getTrades(portfolioId), getPortfolioCoach(portfolioId)]).then(([data, history, coachData]) => {
        if (!active) return;
        setSummary(data);
        setTrades(history.trades);
        setCoach(coachData);
        setError("");
      }).catch(() => { if (active) setError("Could not load this portfolio."); });
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [portfolioId]);

  useEffect(() => {
    const symbol = ticker.trim().toUpperCase();
    setQuote(null);
    if (!symbol || symbol.length > 15) return;
    let active = true;
    const timer = window.setTimeout(() => {
      getMarketPrice(symbol).then((data) => { if (active) setQuote(data); }).catch(() => { if (active) setQuote(null); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ticker]);

  async function submitTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (portfolioId === null) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createPaperTrade(portfolioId, ticker, side, Number(shares));
      setNotice(`${side === "BUY" ? "Bought" : "Sold"} ${shares} ${ticker.toUpperCase()} at ${cash(result.trade.price)} per share (paper trade).`);
      setShares("");
      const [data, history, coachData] = await Promise.all([getPortfolio(portfolioId), getTrades(portfolioId), getPortfolioCoach(portfolioId)]);
      setSummary(data);
      setTrades(history.trades);
      setCoach(coachData);
      getPortfolios().then((response: { portfolios: PortfolioOption[] }) => setPortfolios(response.portfolios));
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail ?? "The paper order could not be placed.");
    } finally {
      setBusy(false);
    }
  }

  async function addPortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const portfolio = await createPortfolio(newName, 100000);
      setNewName("");
      setCreatingPortfolio(false);
      const response = await getPortfolios();
      setPortfolios(response.portfolios);
      setPortfolioId(portfolio.id);
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail ?? "Could not create the portfolio.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout().catch(() => {});
    window.location.assign("/login");
  }

  async function updatePreference(key: keyof typeof preferences, value: string) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      await saveLearningPreferences(next);
      if (portfolioId !== null) setCoach(await getPortfolioCoach(portfolioId));
    } catch {
      setError("Could not save your learning preferences.");
    }
  }

  const estimate = quote && shares && Number.isFinite(Number(shares)) ? Number(shares) * quote.price : null;

  return (
    <main className="workspace-page investor-workspace">
      <NavBar />
      <div className="section investor-section">
        <header className="investor-heading">
          <div>
            <p className="investor-kicker">PAPER INVESTING WORKSPACE</p>
            <h1>Portfolio</h1>
            <p className="investor-subtitle">Practice with virtual cash. Every order here is simulated; no real brokerage account is connected.</p>
          </div>
          <button className="quiet-button" onClick={signOut}>Sign out</button>
        </header>

        {portfolios.length > 0 && (
          <div className="portfolio-toolbar">
            <label className="portfolio-select-label" htmlFor="portfolio-select">Portfolio</label>
            <select id="portfolio-select" value={portfolioId ?? ""} onChange={event => setPortfolioId(Number(event.target.value))}>
              {portfolios.map(item => <option value={item.id} key={item.id}>{item.name} · Paper</option>)}
            </select>
            <button className="quiet-button" onClick={() => setCreatingPortfolio(value => !value)}>{creatingPortfolio ? "Cancel" : "＋ New portfolio"}</button>
            <Link className="text-link" href={portfolioId ? `/risk?portfolio_id=${portfolioId}` : "/risk"}>View portfolio risk →</Link>
          </div>
        )}

        {creatingPortfolio && <form className="create-portfolio-form" onSubmit={addPortfolio}>
          <label htmlFor="new-portfolio-name">Portfolio name</label>
          <input id="new-portfolio-name" value={newName} onChange={event => setNewName(event.target.value)} maxLength={64} required placeholder="e.g. Long-term practice" />
          <span className="create-cash-note">Starting virtual cash: $100,000</span>
          <button className="action-button" type="submit" disabled={busy}>Create paper portfolio</button>
        </form>}

        {summary && <>
          <section className="investor-metrics" aria-label="Portfolio summary">
            <div className="investor-metric metric-primary"><span>PORTFOLIO VALUE</span><strong>{cash(summary.total_value)}</strong><small>{summary.valuation_complete ? "Cash plus marked positions" : "Incomplete · quote missing"}</small></div>
            <div className="investor-metric"><span>VIRTUAL CASH</span><strong>{cash(summary.portfolio.cash_balance)}</strong><small>Available for paper orders</small></div>
            <div className="investor-metric"><span>INVESTED</span><strong>{cash(summary.invested_value)}</strong><small>{summary.holdings.length} open positions</small></div>
            <div className="investor-metric"><span>RETURN VS. START</span><strong className={summary.total_return === null ? "" : summary.total_return >= 0 ? "positive" : "negative"}>{summary.total_return === null ? "—" : `${summary.total_return >= 0 ? "+" : "−"}${cash(Math.abs(summary.total_return))}`}</strong><small>{summary.total_pnl_pct === null ? "Waiting for complete quotes" : `${summary.total_pnl_pct >= 0 ? "+" : ""}${summary.total_pnl_pct.toFixed(2)}%`}</small></div>
          </section>

          <section className="investor-grid">
            <div className="investor-panel positions-panel">
              <div className="investor-panel-heading"><div><h2>Positions</h2><p>Holdings valued using the latest quote returned by the configured data source.</p></div><span>{summary.portfolio.name}</span></div>
              {summary.holdings.length ? <div className="investor-table-wrap"><table className="investor-table">
                <thead><tr><th>ASSET</th><th>SHARES</th><th>LAST QUOTE</th><th>MARKET VALUE</th><th>UNREALIZED P&amp;L</th><th>WEIGHT</th></tr></thead>
                <tbody>{summary.holdings.map(holding => <tr key={holding.ticker}>
                  <td><strong>{holding.ticker}</strong><small>{holding.quote_source ?? "Quote unavailable"}</small></td>
                  <td>{holding.shares.toLocaleString()}</td>
                  <td>{holding.current_price === null ? "Unavailable" : cash(holding.current_price)}<small>{timestamp(holding.quote_as_of)}</small></td>
                  <td>{cash(holding.market_value)}</td>
                  <td className={holding.pnl === null ? "" : holding.pnl >= 0 ? "positive" : "negative"}>{holding.pnl === null ? "—" : `${holding.pnl >= 0 ? "+" : "−"}${cash(Math.abs(holding.pnl))}`}<small>{holding.pnl_pct === null ? "—" : `${holding.pnl_pct >= 0 ? "+" : ""}${holding.pnl_pct.toFixed(2)}%`}</small></td>
                  <td>{holding.weight === null ? "—" : `${holding.weight.toFixed(1)}%`}</td>
                </tr>)}</tbody>
              </table></div> : <div className="empty-portfolio"><span className="empty-mark">＋</span><strong>Your portfolio starts here.</strong><p>Search a ticker in the order ticket and place a paper trade to add a position.</p></div>}
              <div className="quote-disclosure">{summary.market_data.notice} Refresh interval: {summary.market_data.cache_ttl_seconds}s. Source: {summary.market_data.provider}.</div>
            </div>

            <form className="investor-panel order-panel" onSubmit={submitTrade}>
              <div className="investor-panel-heading"><div><h2>Paper order</h2><p>Preview the latest available quote before simulating.</p></div><span className="sim-tag">SIMULATED</span></div>
              <div className="trade-side-control" role="group" aria-label="Order side">
                <button type="button" className={side === "BUY" ? "selected buy-selected" : ""} onClick={() => setSide("BUY")}>Buy</button>
                <button type="button" className={side === "SELL" ? "selected sell-selected" : ""} onClick={() => setSide("SELL")}>Sell</button>
              </div>
              <label htmlFor="order-ticker">Ticker</label>
              <input id="order-ticker" autoComplete="off" value={ticker} onChange={event => setTicker(event.target.value.toUpperCase())} placeholder="AAPL" maxLength={15} required />
              <label htmlFor="order-shares">Shares</label>
              <input id="order-shares" type="number" min="0.000001" step="any" value={shares} onChange={event => setShares(event.target.value)} placeholder="0" required />
              <div className="quote-preview">
                <span>Latest available quote</span>
                <strong>{quote ? cash(quote.price) : ticker ? "Looking up quote…" : "Enter a ticker"}</strong>
                {quote && <small>{quote.source} · bar {timestamp(quote.quote_as_of)} · fetched {timestamp(quote.fetched_at)}</small>}
                {estimate !== null && <small>Indicative order value: {cash(estimate)} before any fees</small>}
              </div>
              <button className="action-button" type="submit" disabled={busy || !quote || !shares}>{busy ? "Submitting…" : `${side} paper order`}</button>
              <p className="order-disclaimer">This simulator uses the latest available quote, not a live execution price. Orders do not reach a broker or exchange.</p>
            </form>
          </section>

          <section className="investor-panel coach-panel">
            <div className="investor-panel-heading"><div><h2>Portfolio coach</h2><p>Explainable observations from your positions and quote timestamps.</p></div><span className="coach-mode">{coach?.generative_ai_connected ? "AI-assisted" : "Transparent rules"}</span></div>
            <div className="coach-preferences">
              <label>Learning level
                <select value={preferences.experience_level} onChange={event => updatePreference("experience_level", event.target.value)}>
                  <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
                </select>
              </label>
              <label>Risk comfort
                <select value={preferences.risk_tolerance} onChange={event => updatePreference("risk_tolerance", event.target.value)}>
                  <option value="conservative">Conservative</option><option value="moderate">Moderate</option><option value="aggressive">Aggressive</option>
                </select>
              </label>
              <label>Time horizon
                <select value={preferences.investment_horizon} onChange={event => updatePreference("investment_horizon", event.target.value)}>
                  <option value="short_term">Short term</option><option value="medium_term">Medium term</option><option value="long_term">Long term</option>
                </select>
              </label>
            </div>
            {coach && <>
              <div className="coach-lesson"><span>LEARNING NOTE</span><p>{coach.lesson}</p></div>
              <div className="coach-insights">{coach.insights.map((insight: any, index: number) => <article className="coach-insight" key={`${insight.kind}-${index}`}>
                <span className={`insight-mark insight-${insight.kind}`} />
                <div><strong>{insight.title}</strong><p>{insight.detail}</p></div>
                <small>{insight.metric}</small>
              </article>)}</div>
              <p className="coach-disclaimer">{coach.disclaimer} <Link href="/learn">Open the learning library →</Link></p>
            </>}
          </section>

          <section className="investor-panel trade-history-panel">
            <div className="investor-panel-heading"><div><h2>Activity</h2><p>Paper orders recorded for this portfolio.</p></div><span>{trades.length} recent trades</span></div>
            {trades.length ? <div className="investor-table-wrap"><table className="investor-table trade-table"><thead><tr><th>TIME</th><th>SIDE</th><th>TICKER</th><th>SHARES</th><th>SIMULATED PRICE</th><th>QUOTE SOURCE</th></tr></thead>
              <tbody>{trades.map(trade => <tr key={trade.id}><td>{new Date(trade.executed_at * 1000).toLocaleString()}</td><td><span className={`side-badge ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td><strong>{trade.ticker}</strong></td><td>{trade.shares}</td><td>{cash(trade.price)}</td><td>{trade.quote_source}<small>Provider bar {timestamp(trade.quote_as_of)}</small></td></tr>)}</tbody></table></div> : <div className="activity-empty">No paper orders yet.</div>}
          </section>
        </>}
        {!summary && portfolios.length === 0 && <div className="first-portfolio"><p>{error || "Preparing your paper portfolio…"}</p></div>}
        {error && <p className="investor-error" role="alert">{error}</p>}
        {notice && <p className="investor-success" role="status">{notice}</p>}
        <footer className="investor-footer">MarketRisk is an educational simulator. No real orders are placed, and market data may be delayed, cached, or unavailable.</footer>
      </div>
    </main>
  );
}
