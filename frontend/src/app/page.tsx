"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/nav/NavBar";
import { getMarketOverview, getMovers, getPortfolio } from "@/lib/api";

type Holding = {
  ticker: string;
  market_value: number;
  weight: number;
  pnl_pct: number;
};

type Portfolio = {
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  num_holdings: number;
  holdings: Holding[];
};

type MarketSummary = {
  index?: string;
  index_change_pct?: number;
  market_mode?: string;
};

type MarketOverview = {
  market_summary?: MarketSummary;
  gainers?: Array<{ ticker: string; change_pct: number }>;
  most_active?: Array<{ ticker: string; volume: number }>;
};

type Mover = { ticker: string; price: number; change_pct: number };

const AREAS = [
  {
    id: "portfolio",
    eyebrow: "PORTFOLIO",
    title: "Your positions.\nOne clear view.",
    description: "See value, performance, and allocation together, with every holding connected to the bigger picture.",
    href: "/portfolio",
    link: "Learn more about Portfolio",
  },
  {
    id: "risk",
    eyebrow: "RISK ENGINE",
    title: "Understand\nwhat’s at risk.",
    description: "Explore Value at Risk, expected shortfall, drawdown, and Monte Carlo scenarios from one focused workspace.",
    href: "/risk",
    link: "Learn more about Risk",
  },
  {
    id: "analytics",
    eyebrow: "ANALYTICS",
    title: "Find the shape\nof your exposure.",
    description: "Compare how assets move together, test market shocks, and follow risk snapshots through time.",
    href: "/analytics",
    link: "Learn more about Analytics",
  },
  {
    id: "stocks",
    eyebrow: "MARKET EXPLORER",
    title: "A sharper view\nof the market.",
    description: "Scan active names, compare equities, and bring price action and fundamentals into the same view.",
    href: "/stocks",
    link: "Learn more about Stocks",
  },
];

function money(value = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function signedPercent(value?: number) {
  if (value === undefined || value === null) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [market, setMarket] = useState<MarketOverview | null>(null);
  const [movers, setMovers] = useState<{ gainers?: Mover[]; losers?: Mover[] } | null>(null);

  useEffect(() => {
    getPortfolio().then(setPortfolio).catch(() => {});
    getMarketOverview().then(setMarket).catch(() => {});
    getMovers().then(setMovers).catch(() => {});
  }, []);

  const holdings = portfolio?.holdings?.slice(0, 5) ?? [];
  const activeNames = market?.most_active?.slice(0, 4) ?? [];
  const marketSummary = market?.market_summary;

  return (
    <main className="home-page">
      <NavBar variant="light" />
      {movers && (
        <div className="market-ticker" aria-label="Market movers">
          <span className="ticker-label">MARKET WATCH</span>
          <div className="ticker-track">
            {[...(movers.gainers ?? []).slice(0, 5), ...(movers.losers ?? []).slice(0, 5)].map((mover, index) => (
              <span className="ticker-item" key={`${mover.ticker}-${index}`}>
                <strong>{mover.ticker}</strong>
                <span>{money(mover.price)}</span>
                <span className={mover.change_pct >= 0 ? "positive" : "negative"}>
                  {signedPercent(mover.change_pct)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> PORTFOLIO INTELLIGENCE</p>
          <h1>Risk, made<br />understandable.</h1>
          <p className="hero-description">
            A clearer perspective on your portfolio, market exposure, and the scenarios that matter.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/portfolio">Explore your portfolio <span aria-hidden="true">→</span></Link>
            <Link className="text-link" href="/risk">Explore the risk engine</Link>
          </div>
        </div>

        <div className="product-preview" aria-label="Live portfolio overview">
          <div className="preview-toolbar">
            <div className="preview-brand"><span className="brand-mark">M</span> MarketRisk <span className="preview-divider">/</span> Portfolio</div>
            <div className="preview-live"><span className="status-dot" /> MARKET SNAPSHOT</div>
          </div>
          <div className="preview-content">
            <div className="preview-summary">
              <div>
                <p className="preview-label">TOTAL PORTFOLIO VALUE</p>
                <p className="preview-value">{portfolio ? money(portfolio.total_value) : "Loading…"}</p>
                <p className={portfolio && portfolio.total_pnl_pct < 0 ? "preview-change negative" : "preview-change positive"}>
                  {portfolio ? `${signedPercent(portfolio.total_pnl_pct)} overall return` : "Connecting to portfolio data"}
                </p>
              </div>
              <div className="market-summary">
                <span className="preview-label">{marketSummary?.index ?? "MARKET"}</span>
                <strong>{marketSummary?.market_mode ?? "Market overview"}</strong>
                <span className={marketSummary && (marketSummary.index_change_pct ?? 0) < 0 ? "negative" : "positive"}>
                  {signedPercent(marketSummary?.index_change_pct)}
                </span>
              </div>
            </div>
            <div className="holdings-heading"><span>Largest positions</span><span>{portfolio?.num_holdings ?? "--"} holdings</span></div>
            <div className="holding-list">
              {holdings.length ? holdings.map((holding, index) => (
                <div className="holding-row" key={holding.ticker}>
                  <span className={`holding-symbol symbol-${index}`}>{holding.ticker.slice(0, 1)}</span>
                  <strong>{holding.ticker}</strong>
                  <span className="holding-value">{money(holding.market_value)}</span>
                  <span className="holding-weight">{holding.weight.toFixed(1)}%</span>
                  <span className={holding.pnl_pct >= 0 ? "positive" : "negative"}>{signedPercent(holding.pnl_pct)}</span>
                  <span className="weight-track"><span style={{ width: `${Math.max(holding.weight, 2)}%` }} /></span>
                </div>
              )) : <p className="empty-preview">Your portfolio snapshot will appear here.</p>}
            </div>
          </div>
          <div className="preview-footer"><span>Portfolio overview</span><span>Updated from your local API</span></div>
        </div>
      </section>

      <section className="market-strip" aria-label="Market snapshot">
        <div><span className="strip-label">MARKET MODE</span><strong>{marketSummary?.market_mode ?? "—"}</strong></div>
        <div><span className="strip-label">REFERENCE INDEX</span><strong>{marketSummary?.index ?? "—"}</strong></div>
        <div><span className="strip-label">ACTIVE NAMES</span><strong>{activeNames.map((name) => name.ticker).join(" · ") || "—"}</strong></div>
        <Link href="/stocks">Open market explorer <span aria-hidden="true">→</span></Link>
      </section>

      {AREAS.map((area, index) => (
        <section className={`story-section story-${area.id}`} id={area.id} key={area.id}>
          <div className="story-inner">
            <div className="story-copy">
              <p className="eyebrow">{area.eyebrow}</p>
              <h2>{area.title}</h2>
              <p>{area.description}</p>
              <Link className="learn-link" href={area.href}>{area.link} <span aria-hidden="true">→</span></Link>
            </div>
            <div className={`story-art art-${area.id}`} aria-hidden="true">
              {area.id === "portfolio" && (
                <div className="allocation-visual">
                  <div className="visual-topline"><span>Portfolio allocation</span><span>Today</span></div>
                  {holdings.slice(0, 4).map((holding, holdingIndex) => (
                    <div className="allocation-row" key={holding.ticker}>
                      <span>{holding.ticker}</span>
                      <div className="allocation-bar"><span style={{ width: `${Math.max(holding.weight, 3)}%` }} /></div>
                      <strong>{holding.weight.toFixed(1)}%</strong>
                    </div>
                  ))}
                  {!holdings.length && <div className="allocation-empty">Allocation appears when portfolio data is available.</div>}
                  <div className="allocation-total"><span>{portfolio?.num_holdings ?? "--"} positions</span><strong>{portfolio ? money(portfolio.total_value) : "Portfolio value"}</strong></div>
                </div>
              )}
              {area.id === "risk" && (
                <div className="risk-visual">
                  <div className="risk-orbit orbit-one" /><div className="risk-orbit orbit-two" />
                  <div className="risk-core"><span>RISK</span><strong>01</strong><small>PORTFOLIO</small></div>
                  <div className="risk-chip chip-var">VaR <strong>95%</strong></div>
                  <div className="risk-chip chip-cvar">CVaR <strong>Tail loss</strong></div>
                  <div className="risk-chip chip-mc">Monte Carlo <strong>Scenarios</strong></div>
                </div>
              )}
              {area.id === "analytics" && (
                <div className="matrix-visual">
                  <div className="matrix-head"><span>Asset relationships</span><span>Correlation</span></div>
                  <div className="matrix-labels"><span>AAPL</span><span>MSFT</span><span>NVDA</span><span>SPY</span></div>
                  <div className="matrix-grid">
                    {[0.9,0.7,0.4,0.8,0.7,0.9,0.5,0.8,0.4,0.5,0.9,0.6,0.8,0.8,0.6,0.9].map((value, cell) => (
                      <span key={cell} style={{ opacity: 0.18 + value * 0.72 }} />
                    ))}
                  </div>
                  <div className="matrix-caption">Correlation · stress testing · risk history</div>
                </div>
              )}
              {area.id === "stocks" && (
                <div className="stocks-visual">
                  <div className="visual-topline"><span>Market activity</span><span>Today</span></div>
                  {(activeNames.length ? activeNames : [{ ticker: "Market", volume: 0 }]).map((name, stockIndex) => (
                    <div className="active-row" key={name.ticker}>
                      <span className={`stock-index index-${stockIndex}`}>0{stockIndex + 1}</span>
                      <strong>{name.ticker}</strong>
                      <span>{name.volume ? `${(name.volume / 1_000_000).toFixed(1)}M shares` : "Live market feed"}</span>
                      <span className="row-arrow">↗</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {index < AREAS.length - 1 && <div className="story-rule" />}
        </section>
      ))}

      <footer className="home-footer">
        <Link href="/" className="footer-brand">MarketRisk</Link>
        <span>Financial risk analytics</span>
        <div><Link href="/portfolio">Portfolio</Link><Link href="/risk">Risk</Link><Link href="/analytics">Analytics</Link><Link href="/stocks">Stocks</Link></div>
      </footer>
    </main>
  );
}
