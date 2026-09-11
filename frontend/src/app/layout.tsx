import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MarketRisk — Financial Risk Analytics", description: "Portfolio risk analytics — VaR, Sharpe Ratio, Beta, Monte Carlo" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
