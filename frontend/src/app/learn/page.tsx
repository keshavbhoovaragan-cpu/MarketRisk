"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/nav/NavBar";

const PATHS = {
  beginner: {
    label: "Beginner", intro: "Build the vocabulary and habits that make market data easier to interpret.",
    lessons: [
      { title: "What does owning a share mean?", time: "5 min", body: "A share is a unit of ownership in a company. Its market price changes as buyers and sellers react to new information, expectations, and broader market conditions." },
      { title: "Market orders and paper orders", time: "4 min", body: "A market order asks to trade promptly at the best available price. A displayed quote is not a guaranteed fill price. MarketRisk paper orders use a recent provider quote to simulate a fill and do not reach an exchange." },
      { title: "Return, risk, and diversification", time: "6 min", body: "Return describes a change in value. Risk describes uncertainty and potential loss. Holding different securities does not automatically diversify a portfolio when those assets respond to the same drivers." },
      { title: "Reading a portfolio value", time: "4 min", body: "Marked equity is virtual cash plus shares multiplied by available quote prices. If quotes are missing or stale, the displayed total may be incomplete; check the timestamp and source." },
    ],
  },
  intermediate: {
    label: "Intermediate", intro: "Move from headline returns to the distribution and co-movement beneath them.",
    lessons: [
      { title: "Value at Risk and expected shortfall", time: "7 min", body: "VaR estimates a loss threshold at a chosen confidence level and horizon. It does not describe the size of losses beyond that threshold; expected shortfall summarizes the tail conditional on crossing it." },
      { title: "Volatility and Sharpe ratio", time: "6 min", body: "Volatility measures return dispersion, not direction. Sharpe compares excess return with total volatility, and can be unstable for short histories or non-normal returns." },
      { title: "Correlation is not a constant", time: "5 min", body: "Historical correlation summarizes co-movement over a selected sample. Correlations can change during stress, and a low historical reading is not a guarantee of future diversification." },
      { title: "Sizing a paper order", time: "5 min", body: "Compare notional order value with portfolio equity and virtual cash before submitting. Consider how a price gap, fees, liquidity, or concentration could change the result." },
    ],
  },
  advanced: {
    label: "Advanced", intro: "Interrogate model assumptions, data quality, and the path from estimates to decisions.",
    lessons: [
      { title: "Historical VaR limitations", time: "8 min", body: "Historical simulation assumes the chosen lookback represents plausible future outcomes. Regime shifts, survivorship bias, corporate actions, missing observations, and sample size affect the estimate." },
      { title: "Monte Carlo model risk", time: "8 min", body: "Simulation output is conditional on the return-generating process, parameter estimates, dependence assumptions, and random seed. More draws reduce Monte Carlo error but do not fix a misspecified model." },
      { title: "Liquidity and execution", time: "6 min", body: "Midpoint or last-trade marks do not account for spread, market impact, partial fills, halts, or venue conditions. This paper-trading app does not model execution quality." },
      { title: "Data lineage and quote freshness", time: "5 min", body: "Record provider, instrument, exchange/session context, observation timestamp, retrieval timestamp, adjustments, and transformations. A frequently refreshed API cache cannot make a delayed upstream feed real-time." },
    ],
  },
};

type Level = keyof typeof PATHS;

export default function LearnPage() {
  const [level, setLevel] = useState<Level>("beginner");
  const path = PATHS[level];
  return (
    <main className="workspace-page learn-page">
      <NavBar />
      <div className="section learn-section">
        <header className="learn-heading">
          <p className="investor-kicker">MARKETRISK LEARNING PATH</p>
          <h1>Learn the market.<br />Question the model.</h1>
          <p>Short lessons move from first principles to portfolio risk and data lineage. Educational material, not personal investment advice.</p>
        </header>
        <div className="workspace-tabs learn-level-tabs" role="tablist" aria-label="Learning level">
          {(Object.keys(PATHS) as Level[]).map(item => <button key={item} role="tab" aria-selected={level === item} className={`workspace-tab${level === item ? " is-active" : ""}`} onClick={() => setLevel(item)}>{PATHS[item].label}</button>)}
        </div>
        <section className="learn-path-intro"><span>{path.label.toUpperCase()} PATH</span><p>{path.intro}</p><Link href="/portfolio">Practice in your paper portfolio →</Link></section>
        <div className="lesson-list">{path.lessons.map((lesson, index) => <article className="lesson-row" key={lesson.title}>
          <span className="lesson-number">{String(index + 1).padStart(2, "0")}</span>
          <div><h2>{lesson.title}</h2><p>{lesson.body}</p></div>
          <span className="lesson-time">{lesson.time}</span>
        </article>)}</div>
        <footer className="learning-source-note">MarketRisk market data currently comes from Yahoo Finance through yfinance. Availability, delay, and timestamps depend on that upstream provider.</footer>
      </div>
    </main>
  );
}
