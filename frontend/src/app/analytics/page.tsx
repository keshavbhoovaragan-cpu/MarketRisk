"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/nav/NavBar";
import { getPortfolioRisk, getRiskHistory } from "@/lib/api";

export default function AnalyticsPage() {
  const [risk, setRisk] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ Promise.all([getPortfolioRisk().then(setRisk).catch(()=>{}),getRiskHistory().then(r=>setHistory(r.snapshots||[])).catch(()=>{})]).finally(()=>setLoading(false)); },[]);
  return (
    <main className="workspace-page" style={{minHeight:"100vh"}}><NavBar/>
      <div className="section">
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,color:"rgba(167,139,250,0.6)",letterSpacing:"0.2em",fontWeight:700,marginBottom:8}}>PORTFOLIO ANALYTICS</div>
          <h1 style={{fontSize:36,fontWeight:900,lineHeight:1,letterSpacing:"-0.025em",marginBottom:8,background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Analytics</h1>
          <p style={{color:"var(--text-muted)",fontSize:14}}>Correlation matrix · Risk history · Diversification analysis</p>
        </div>
        {loading?(<div style={{display:"grid",gap:16}}>{Array.from({length:3}).map((_,i)=>(<div key={i} className="skeleton" style={{height:200,borderRadius:14}}/>))}</div>):(
          <>
            {risk?.correlation?.tickers&&(
              <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                <div className="table-header"><span style={{fontWeight:700,fontSize:13}}>Correlation Matrix</span><span style={{fontSize:10,color:"var(--text-dim)"}}>1.0 = perfectly correlated · -1 = inverse</span></div>
                <div style={{padding:20,overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr><th style={{padding:"6px 10px",color:"var(--text-dim)",fontSize:10,fontWeight:700}}></th>{risk.correlation.tickers.map((t:string)=>(<th key={t} style={{padding:"6px 10px",color:"var(--text-muted)",fontWeight:700,fontSize:11}}>{t}</th>))}</tr></thead>
                    <tbody>{risk.correlation.matrix.map((row:number[],i:number)=>(<tr key={i}><td style={{padding:"6px 10px",fontWeight:700,fontSize:11,color:"var(--text-muted)"}}>{risk.correlation.tickers[i]}</td>{row.map((val:number,j:number)=>{const bg=i===j?"rgba(96,165,250,0.15)":val>0.7?"rgba(248,113,113,0.15)":val>0.4?"rgba(251,191,36,0.08)":val<0?"rgba(34,197,94,0.08)":"transparent";const color=i===j?"#60a5fa":val>0.7?"#f87171":val>0.4?"#fbbf24":val<0?"#22c55e":"var(--text-muted)";return(<td key={j} style={{padding:"6px 10px",textAlign:"center",background:bg,borderRadius:4,fontWeight:i===j?700:500,color,fontSize:12}}>{val.toFixed(2)}</td>);})}</tr>))}</tbody>
                  </table>
                </div>
                <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:16,flexWrap:"wrap"}}>
                  {[{color:"#f87171",bg:"rgba(248,113,113,0.15)",label:"High correlation (>0.7) — concentrated risk"},{color:"#fbbf24",bg:"rgba(251,191,36,0.08)",label:"Moderate (0.4-0.7)"},{color:"#22c55e",bg:"rgba(34,197,94,0.08)",label:"Negative — good diversification"}].map(({color,bg,label})=>(<div key={label} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,borderRadius:3,background:bg,border:`1px solid ${color}40`}}/><span style={{fontSize:11,color:"var(--text-dim)"}}>{label}</span></div>))}
                </div>
              </div>
            )}
            {history.length>0&&(
              <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                <div className="table-header"><span style={{fontWeight:700,fontSize:13}}>Risk History</span><span style={{fontSize:10,color:"var(--text-dim)"}}>SAVED ON EACH ANALYSIS RUN</span></div>
                <table className="data-table">
                  <thead><tr>{["DATE","VaR 95%","VaR 99%","SHARPE","BETA","VOLATILITY","MAX DD"].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
                  <tbody>{history.slice(0,10).map((s:any,i:number)=>(<tr key={i}><td style={{color:"var(--text-muted)",fontSize:12}}>{s.snapshot_date}</td><td style={{color:"#f87171",fontWeight:700}}>{s.var_95}%</td><td style={{color:"#f87171",fontWeight:700}}>{s.var_99}%</td><td style={{color:s.sharpe_ratio>1?"#22c55e":"#fbbf24",fontWeight:700}}>{s.sharpe_ratio}</td><td style={{color:"var(--text-muted)"}}>{s.beta}</td><td style={{color:"var(--text-muted)"}}>{s.volatility}%</td><td style={{color:"#f87171"}}>{s.max_drawdown}%</td></tr>))}</tbody>
                </table>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {[{title:"Value at Risk (VaR)",color:"#60a5fa",desc:"Maximum expected loss at a given confidence level. VaR(95%, 1-day) = 2% means 5% chance of losing more than 2% in a single trading day. Used by banks for Basel III regulatory capital."},{title:"Sharpe Ratio",color:"#22c55e",desc:"Risk-adjusted returns: (Return - Risk Free Rate) / Volatility. Above 2.0 is excellent. Below 0 means T-bills outperform on a risk-adjusted basis."},{title:"Beta",color:"#a78bfa",desc:"Sensitivity to market movements vs S&P 500. Beta=1.5 means if market falls 10%, portfolio typically falls 15%. Beta<0 moves opposite to the market."},{title:"Monte Carlo",color:"#fbbf24",desc:"Generates thousands of random future return paths. Same methodology used by Goldman Sachs and JP Morgan for regulatory risk management."}].map(({title,color,desc})=>(<div key={title} className="card" style={{padding:"20px 22px"}}><div style={{fontWeight:800,fontSize:14,marginBottom:10,color}}>{title}</div><p style={{color:"var(--text-muted)",fontSize:13,lineHeight:1.75}}>{desc}</p></div>))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
