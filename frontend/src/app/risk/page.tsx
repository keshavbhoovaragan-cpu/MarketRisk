"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/nav/NavBar";
import { getPortfolioRisk, getStressTest } from "@/lib/api";

export default function RiskPage() {
  const [risk, setRisk] = useState<any>(null);
  const [stress, setStress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview"|"holdings"|"stress"|"monte-carlo">("overview");
  useEffect(()=>{ setLoading(true); Promise.all([getPortfolioRisk().then(setRisk).catch(()=>{}),getStressTest().then(setStress).catch(()=>{})]).finally(()=>setLoading(false)); },[]);
  const gc=(g:string)=>({A:"#22c55e",B:"#86efac",C:"#fbbf24",D:"#fb923c",F:"#f87171"}[g]||"#9ca3af");
  const rc=(v:number)=>v<1.5?"#22c55e":v<2.5?"#fbbf24":"#f87171";
  const M=({label,value,sub,color,explain}:{label:string,value:any,sub?:string,color?:string,explain?:string})=>(
    <div className="card" style={{padding:"18px 20px"}}>
      <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:"0.12em",marginBottom:10,fontWeight:700,textTransform:"uppercase"}}>{label}</div>
      <div style={{fontSize:26,fontWeight:900,color:color||"var(--text)",letterSpacing:"-0.02em",lineHeight:1,marginBottom:4}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"var(--text-dim)",marginBottom:6}}>{sub}</div>}
      {explain&&<div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.6,borderTop:"1px solid var(--border)",paddingTop:8,marginTop:4}}>{explain}</div>}
    </div>
  );
  return (
    <main style={{minHeight:"100vh"}}><NavBar/>
      <div className="section">
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,color:"rgba(96,165,250,0.6)",letterSpacing:"0.2em",fontWeight:700,marginBottom:8}}>RISK ANALYTICS ENGINE</div>
          <h1 style={{fontSize:36,fontWeight:900,lineHeight:1,letterSpacing:"-0.025em",marginBottom:8,background:"linear-gradient(135deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Risk Dashboard</h1>
          <p style={{color:"var(--text-muted)",fontSize:14}}>VaR · CVaR · Sharpe · Beta · Max Drawdown · Monte Carlo · Stress Testing</p>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:24,background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",borderRadius:10,padding:4,width:"fit-content"}}>
          {(["overview","holdings","stress","monte-carlo"] as const).map(t=>(<button key={t} onClick={()=>setTab(t)} style={{padding:"7px 16px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",textTransform:"capitalize",background:tab===t?"rgba(96,165,250,0.12)":"transparent",color:tab===t?"#60a5fa":"var(--text-muted)",fontFamily:"inherit",letterSpacing:"0.03em"}}>{t.replace("-"," ")}</button>))}
        </div>
        {loading?(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>{Array.from({length:8}).map((_,i)=>(<div key={i} className="skeleton" style={{height:120,borderRadius:14}}/>))}</div>)
        :!risk?(<div style={{textAlign:"center",padding:80,color:"var(--text-dim)"}}><div style={{fontSize:32,marginBottom:12}}>⚠️</div><div>Could not load risk data. Make sure the backend is running on port 8001.</div></div>)
        :tab==="overview"?(
          <>
            <div style={{background:`${gc(risk.risk_grade)}10`,border:`1px solid ${gc(risk.risk_grade)}30`,borderRadius:16,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",gap:20}}>
              <div style={{fontSize:48,fontWeight:900,color:gc(risk.risk_grade),lineHeight:1}}>{risk.risk_grade}</div>
              <div><div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Portfolio Risk Grade</div><div style={{color:"var(--text-muted)",fontSize:13}}>{risk.interpretation?.var_summary}</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              <M label="VaR (95%)" value={`${risk.var_95}%`} sub="Daily max loss" color={rc(risk.var_95)} explain="5% chance of losing more than this in a single day"/>
              <M label="VaR (99%)" value={`${risk.var_99}%`} sub="Daily max loss" color={rc(risk.var_99)} explain="1% chance of losing more than this in a single day"/>
              <M label="CVaR (95%)" value={`${risk.cvar_95}%`} sub="Expected shortfall" color={rc(risk.cvar_95)} explain="Average loss on worst days beyond VaR"/>
              <M label="Volatility" value={`${risk.volatility}%`} sub="Annualized std dev" color={risk.volatility>25?"#f87171":risk.volatility>15?"#fbbf24":"#22c55e"} explain="How much the portfolio fluctuates annually"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              <M label="Sharpe Ratio" value={risk.sharpe_ratio} sub="Risk-adjusted return" color={risk.sharpe_ratio>2?"#22c55e":risk.sharpe_ratio>1?"#86efac":risk.sharpe_ratio>0?"#fbbf24":"#f87171"} explain={risk.interpretation?.sharpe_summary}/>
              <M label="Sortino Ratio" value={risk.sortino_ratio} sub="Downside risk-adj" color={risk.sortino_ratio>2?"#22c55e":risk.sortino_ratio>1?"#86efac":"#fbbf24"} explain="Only penalizes downside volatility"/>
              <M label="Beta" value={risk.beta} sub="Market sensitivity" color={risk.beta>1.5?"#f87171":risk.beta<0?"#a78bfa":"#60a5fa"} explain={risk.interpretation?.beta_summary}/>
              <M label="Alpha" value={`${risk.alpha>0?"+":""}${risk.alpha}`} sub="Excess return vs CAPM" color={risk.alpha>0?"#22c55e":"#f87171"} explain={`${risk.alpha>0?"Outperforming":"Underperforming"} risk-adjusted market`}/>
            </div>
            <M label="Max Drawdown" value={`${risk.max_drawdown}%`} sub={`Peak: ${risk.max_drawdown_peak} → Trough: ${risk.max_drawdown_trough}`} color="#f87171" explain="Worst peak-to-trough decline over the analysis period"/>
          </>
        ):tab==="holdings"?(
          <div className="card" style={{overflow:"hidden"}}>
            <div className="table-header"><span style={{fontWeight:700,fontSize:13}}>Individual Holding Risk</span><span style={{fontSize:10,color:"var(--text-dim)"}}>SORTED BY VAR</span></div>
            <table className="data-table">
              <thead><tr>{["TICKER","WEIGHT","VAR 95%","VOLATILITY","SHARPE","BETA","RISK"].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
              <tbody>{(risk.holding_risks||[]).map((h:any)=>(<tr key={h.ticker}>
                <td><span style={{fontWeight:800,fontSize:14}}>{h.ticker}</span></td>
                <td style={{color:"var(--text-muted)"}}>{h.weight}%</td>
                <td style={{color:rc(h.var_95),fontWeight:700}}>{h.var_95}%</td>
                <td style={{color:"var(--text-muted)"}}>{h.volatility}%</td>
                <td style={{color:h.sharpe>1?"#22c55e":h.sharpe>0?"#fbbf24":"#f87171",fontWeight:700}}>{h.sharpe}</td>
                <td style={{color:"var(--text-muted)"}}>{h.beta}</td>
                <td><span style={{fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:700,background:h.var_95<1.5?"rgba(34,197,94,0.1)":h.var_95<2.5?"rgba(251,191,36,0.1)":"rgba(248,113,113,0.1)",color:h.var_95<1.5?"#22c55e":h.var_95<2.5?"#fbbf24":"#f87171"}}>{h.var_95<1.5?"LOW":h.var_95<2.5?"MEDIUM":"HIGH"}</span></td>
              </tr>))}</tbody>
            </table>
          </div>
        ):tab==="stress"?(
          <div>
            <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:20,lineHeight:1.7}}>How would your portfolio have performed during major historical market crashes?</div>
            <div style={{display:"grid",gap:10}}>{(stress?.stress_tests||[]).map((s:any)=>(
              <div key={s.scenario} className="card" style={{padding:"18px 24px",display:"grid",gridTemplateColumns:"1fr auto auto auto",alignItems:"center",gap:24}}>
                <div><div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{s.scenario}</div><div style={{fontSize:12,color:"var(--text-dim)"}}>Market fell {s.market_drop_pct}% · Portfolio est. {s.portfolio_drop_pct}%</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:9,color:"var(--text-dim)",marginBottom:4}}>DROP</div><div style={{fontSize:20,fontWeight:900,color:"#f87171"}}>{s.portfolio_drop_pct}%</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:9,color:"var(--text-dim)",marginBottom:4}}>EST. LOSS</div><div style={{fontSize:20,fontWeight:900,color:"#f87171"}}>-${Math.abs(s.estimated_loss).toLocaleString("en-US",{maximumFractionDigits:0})}</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:9,color:"var(--text-dim)",marginBottom:4}}>REMAINING</div><div style={{fontSize:20,fontWeight:900}}>${s.remaining_value?.toLocaleString("en-US",{maximumFractionDigits:0})}</div></div>
              </div>
            ))}</div>
          </div>
        ):(
          <div>
            {risk.monte_carlo&&(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
              <M label="Monte Carlo VaR 95%" value={`${risk.monte_carlo.var_95}%`} color="#60a5fa" explain={`Based on ${risk.monte_carlo.simulations?.toLocaleString()} simulations`}/>
              <M label="Monte Carlo VaR 99%" value={`${risk.monte_carlo.var_99}%`} color="#a78bfa" explain="Worst-case daily loss at 99% confidence"/>
              <M label="Expected Shortfall" value={`${risk.monte_carlo.expected_loss}%`} color="#f87171" explain="Average loss in worst 5% of scenarios"/>
            </div>)}
            <div className="card" style={{padding:"20px 24px"}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>About Monte Carlo VaR</div>
              <p style={{color:"var(--text-muted)",fontSize:13,lineHeight:1.8}}>Generates {risk.monte_carlo?.simulations?.toLocaleString()} random future return scenarios based on historical mean and standard deviation. Same methodology used by investment banks for regulatory capital calculations under Basel III.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
