"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { login, register } from "@/lib/api";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await register(email, password);
      else await login(email, password);
      window.location.assign("/portfolio");
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail ?? "We could not sign you in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-nav"><Link href="/" className="auth-brand">MarketRisk</Link><span>Paper investing · No brokerage connected</span></header>
      <section className="auth-layout">
        <div className="auth-story">
          <p className="auth-eyebrow">A CLEARER WAY TO LEARN THE MARKETS</p>
          <h1>Build your<br />investing practice.</h1>
          <p>Track market data, explore risk, and practice portfolio decisions with virtual cash before putting real money at risk.</p>
          <div className="auth-proof"><span>01</span> Quotes include their source and provider timestamp.</div>
          <div className="auth-proof"><span>02</span> Orders in this workspace are simulations only.</div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <p className="auth-eyebrow">YOUR WORKSPACE</p>
          <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-form-note">Each account gets private portfolios and a $100,000 virtual starting balance.</p>
          <label htmlFor="account-email">Email</label>
          <input id="account-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
          <label htmlFor="account-password">Password</label>
          <input id="account-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : 1} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} />
          {mode === "register" && <p className="auth-hint">Use at least 12 characters.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Working…" : mode === "register" ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></button>
          <button className="auth-switch" type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>
            {mode === "register" ? "Already have an account? Sign in" : "New to MarketRisk? Create an account"}
          </button>
          <p className="auth-disclaimer">Educational paper-trading workspace. Not a brokerage, investment adviser, or source of guaranteed real-time quotes.</p>
        </form>
      </section>
    </main>
  );
}
