"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/nav/NavBar";
import { getPortfolio, getMovers, getMarketOverview } from "@/lib/api";

const FEATURES = [
  {label:"Portfolio",  href:"/portfolio", icon:"💼", color:"#22c55e", desc:"Track holdings, P&L, sector allocation, and position weights in real time"},
  {label:"Risk Engine",href:"/risk",      icon:"⚡", color:"#60a5fa", desc:"VaR, CVaR, Sharpe ratio, Beta, Max Drawdown, and Monte Carlo simulation"},
  {label:"Analytics",  href:"/analytics", icon:"📊", color:"#a78bfa", desc:"Correlation matrix, stress testing, risk history trends over time"},
  {label:"Stocks",     href:"/stocks",    icon:"📈", color:"#fbbf24", desc:"Stock screener, side-by-side comparison, RSI, moving averages, fundamentals"},
];
const STACK = [{label:"Next.js 14",color:"#60a5fa"},{label:"TypeScript",color:"#60a5fa"},{label:"FastAPI",color:"#22c55e"},{label:"Python 3.11",color:"#22c55e"},{label:"NumPy",color:"#fbbf24"},{label:"SQLite",color:"#fbbf24"},{label:"yfinance",color:"#a78bfa"},{label:"Monte Carlo",color:"#f87171"},{label:"VaR/CVaR",color:"#f87171"}];

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [movers, setMovers] = useState<any>(null);
  const [marketOverview, setMarketOverview] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{
    setMounted(true);
    getPortfolio().then(setPortfolio).catch(()=>{});
    getMovers().then(setMovers).catch(()=>{});
    getMarketOverview().then(setMarketOverview).catch(()=>{});
  },[]);
  const fmt = (n: number) => n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(1)}M`:`$${n.toFixed(2)}`;
  const formatSigned = (n: number|undefined) => `${n===undefined ? "--": (n >= 0 ? "+" : "")}${n===undefined ? "" : n.toFixed(2)}%`;
  return (
    <main style={{minHeight:"100vh"}}>
      <NavBar/>
      <div className="orb" style={{width:800,height:800,top:"-15%",left:"-5%",background:"radial-gradient(circle,rgba(34,197,94,0.12) 0%,transparent 65%)",filter:"blur(60px)"}}/>
      <div className="orb" style={{width:600,height:600,top:"40%",right:"-8%",background:"radial-gradient(circle,rgba(96,165,250,0.1) 0%,transparent 65%)",filter:"blur(60px)"}}/>
      {movers&&(
        <div style={{borderBottom:"1px solid var(--border)",overflow:"hidden",height:32,display:"flex",alignItems:"center",position:"relative",zIndex:2}}>
          <div style={{display:"flex",animation:"ticker 30s linear infinite",whiteSpace:"nowrap",paddingLeft:"100%",alignItems:"center"}}>
            {[...(movers.gainers||[]),...(movers.losers||[]),...(movers.gainers||[]),...(movers.losers||[])].map((s:any,i:number)=>(
              <span key={i} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"0 24px",borderRight:"1px solid var(--border)"}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--text-muted)"}}>{s.ticker}</span>
                <span style={{fontSize:11,fontWeight:800}}>${s.price?.toFixed(2)}</span>
                <span style={{fontSize:10,fontWeight:700,color:s.change_pct>=0?"var(--green)":"var(--red)"}}>{s.change_pct>=0?"+":""}{s.change_pct?.toFixed(2)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{maxWidth:1020,margin:"0 auto",padding:"52px 24px 48px",position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:52}}>
          <div className={mounted?"fade-up":""} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 16px",borderRadius:20,background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.14)",marginBottom:24}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"block",animation:"pulse-glow 2s infinite"}}/>
            <span style={{fontSize:10,color:"rgba(34,197,94,0.9)",fontWeight:700,letterSpacing:"0.14em"}}>LIVE MARKET DATA · REAL-TIME RISK ANALYTICS</span>
          </div>
          <h1 className={mounted?"fade-up-2":""} style={{letterSpacing:"-0.04em",lineHeight:0.92,marginBottom:20}}>
            <span style={{display:"block",fontSize:"clamp(52px,7vw,80px)",fontWeight:900,background:"linear-gradient(180deg,#fff 0%,rgba(255,255,255,0.5) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Market</span>
            <span style={{display:"block",fontSize:"clamp(52px,7vw,80px)",fontWeight:900}} className="shine-text">Risk.</span>
          </h1>
          <p className={mounted?"fade-up-3":""} style={{fontSize:16,color:"var(--text-muted)",maxWidth:480,margin:"0 auto",lineHeight:1.8}}>
            Portfolio analytics computing <strong style={{color:"var(--text)"}}>Value at Risk</strong>, <strong style={{color:"var(--text)"}}>Sharpe Ratio</strong>, <strong style={{color:"var(--text)"}}>Beta</strong>, and <strong style={{color:"var(--text)"}}>Monte Carlo</strong> simulations on live market data.
          </p>
        </div>
        {portfolio&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,marginBottom:36,background:"var(--border)",borderRadius:12,overflow:"hidden",border:"1px solid var(--border)"}}>
            {[{label:"Portfolio Value",value:fmt(portfolio.total_value||0),color:"var(--text)"},{label:"Total P&L",value:`${portfolio.total_pnl>=0?"+":""}${fmt(portfolio.total_pnl||0)}`,color:portfolio.total_pnl>=0?"var(--green)":"var(--red)"},{label:"Return",value:`${portfolio.total_pnl_pct>=0?"+":""}${(portfolio.total_pnl_pct||0).toFixed(2)}%`,color:portfolio.total_pnl_pct>=0?"var(--green)":"var(--red)"},{label:"Holdings",value:`${portfolio.num_holdings||0}`,color:"var(--blue)"}].map(({label,value,color})=>(
              <div key={label} style={{background:"var(--bg)",padding:"18px 20px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color,letterSpacing:"-0.02em",marginBottom:4,lineHeight:1}}>{value}</div>
                <div style={{fontSize:11,color:"var(--text-dim)",letterSpacing:"0.04em"}}>{label}</div>
              </div>
            ))}
          </div>
        )}
        {marketOverview && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:36}}>
            <div className="card" style={{padding:"18px 20px"}}>
              <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:"0.14em",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Market Mood</div>
              <div style={{fontSize:26,fontWeight:900,lineHeight:1,marginBottom:6}}>{marketOverview.market_summary?.market_mode}</div>
              <div style={{fontSize:12,color:"var(--text-muted)"}}>{marketOverview.market_summary?.index} {formatSigned(marketOverview.market_summary?.index_change_pct)}</div>
            </div>
            <div className="card" style={{padding:"18px 20px"}}>
              <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:"0.14em",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Top Gainers</div>
              <div style={{display:"grid",gap:6}}>{(marketOverview.gainers||[]).slice(0,3).map((s:any)=>(<div key={s.ticker} style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>{s.ticker}</span><span style={{color:"var(--green)"}}>{s.change_pct?.toFixed(2)}%</span></div>))}</div>
            </div>
            <div className="card" style={{padding:"18px 20px"}}>
              <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:"0.14em",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Active Names</div>
              <div style={{display:"grid",gap:6}}>{(marketOverview.most_active||[]).slice(0,3).map((s:any)=>(<div key={s.ticker} style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>{s.ticker}</span><span style={{color:"var(--text-muted)"}}>{(s.volume/1e6).toFixed(1)}M</span></div>))}</div>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:36}}>
          {FEATURES.map(f=>(
            <Link key={f.href} href={f.href} style={{textDecoration:"none"}}>
              <div className="card" style={{padding:"24px",cursor:"pointer",height:"100%",display:"flex",flexDirection:"column",gap:14}}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=`${f.color}40`;el.style.transform="translateY(-3px)";el.style.boxShadow=`0 12px 40px ${f.color}12`;}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="var(--border)";el.style.transform="translateY(0)";el.style.boxShadow="none";}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:28}}>{f.icon}</span>
                  <span style={{fontSize:12,color:`${f.color}50`,fontWeight:700}}>→</span>
                </div>
                <div>
                  <div style={{color:"var(--text)",fontWeight:800,fontSize:16,marginBottom:6}}>{f.label}</div>
                  <div style={{color:"var(--text-muted)",fontSize:13,lineHeight:1.65}}>{f.desc}</div>
                </div>
                <div style={{height:1,background:`linear-gradient(90deg,${f.color}30,transparent)`,marginTop:"auto"}}/>
              </div>
            </Link>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12,alignItems:"center"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
            {STACK.map(t=>(<span key={t.label} style={{fontSize:10,padding:"4px 11px",borderRadius:20,background:`${t.color}08`,border:`1px solid ${t.color}18`,color:`${t.color}70`,fontWeight:700,letterSpacing:"0.05em"}}>{t.label}</span>))}
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.1)",letterSpacing:"0.1em",fontWeight:700}}>BUILT BY KESHAV BHOOVARAGAN · FINANCIAL RISK ANALYTICS</div>
        </div>
      </div>
    </main>
  );
}
