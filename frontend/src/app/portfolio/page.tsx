"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/nav/NavBar";
import { getPortfolio, removeHolding, addHolding } from "@/lib/api";

export default function PortfolioPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ticker:"",shares:"",avg_cost:""});
  const load = () => { setLoading(true); getPortfolio().then(setData).finally(()=>setLoading(false)); };
  useEffect(()=>{ load(); },[]);
  const drop = async (ticker: string) => { await removeHolding(ticker); load(); };
  const add = async () => {
    if (!form.ticker||!form.shares||!form.avg_cost) return;
    await addHolding(form.ticker,parseFloat(form.shares),parseFloat(form.avg_cost));
    setForm({ticker:"",shares:"",avg_cost:""}); setAdding(false); load();
  };
  const fm = (n:number) => `$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const pc = (n:number) => n>=0?"var(--green)":"var(--red)";
  return (
    <main className="workspace-page" style={{minHeight:"100vh"}}><NavBar/>
      <div className="section">
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,color:"rgba(34,197,94,0.6)",letterSpacing:"0.2em",fontWeight:700,marginBottom:8}}>LIVE PORTFOLIO</div>
          <h1 style={{fontSize:36,fontWeight:900,lineHeight:1,letterSpacing:"-0.025em",marginBottom:8,background:"linear-gradient(135deg,#22c55e,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Portfolio</h1>
          <p style={{color:"var(--text-muted)",fontSize:14}}>Real-time holdings, P&L, position weights, and allocation breakdown</p>
        </div>
        {data&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24}}>
            {[{label:"Total Value",value:`$${data.total_value?.toLocaleString("en-US",{minimumFractionDigits:2})}`,color:"var(--text)"},{label:"Total Cost",value:`$${data.total_cost?.toLocaleString("en-US",{minimumFractionDigits:2})}`,color:"var(--text-muted)"},{label:"Unrealized P&L",value:`${data.total_pnl>=0?"+":""}${fm(data.total_pnl)}`,color:pc(data.total_pnl)},{label:"Return",value:`${data.total_pnl_pct>=0?"+":""}${data.total_pnl_pct?.toFixed(2)}%`,color:pc(data.total_pnl_pct)}].map(({label,value,color})=>(
              <div key={label} className="card" style={{padding:"16px 18px"}}>
                <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:"0.12em",marginBottom:8,fontWeight:700,textTransform:"uppercase"}}>{label}</div>
                <div style={{fontSize:22,fontWeight:900,color,lineHeight:1,letterSpacing:"-0.02em"}}>{value}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
          {adding?(
            <>
              <input placeholder="TICKER" value={form.ticker} onChange={e=>setForm(f=>({...f,ticker:e.target.value.toUpperCase()}))} style={{padding:"8px 12px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:13,outline:"none",width:100}}/>
              <input placeholder="Shares" type="number" value={form.shares} onChange={e=>setForm(f=>({...f,shares:e.target.value}))} style={{padding:"8px 12px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:13,outline:"none",width:100}}/>
              <input placeholder="Avg Cost $" type="number" value={form.avg_cost} onChange={e=>setForm(f=>({...f,avg_cost:e.target.value}))} style={{padding:"8px 12px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:13,outline:"none",width:120}}/>
              <button onClick={add} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"var(--green)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:12}}>Add</button>
              <button onClick={()=>setAdding(false)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--text-muted)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Cancel</button>
            </>
          ):(
            <button onClick={()=>setAdding(true)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text-muted)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--green)")} onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>+ Add Holding</button>
          )}
        </div>
        <div className="card" style={{overflow:"hidden"}}>
          <div className="table-header">
            <span style={{fontWeight:700,fontSize:13}}>Holdings</span>
            {data&&<span style={{fontSize:11,color:"var(--text-dim)"}}>{data.num_holdings} positions</span>}
          </div>
          {loading?(<div style={{padding:"20px 0"}}>{Array.from({length:5}).map((_,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:16,padding:"12px 20px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>{Array.from({length:6}).map((_,j)=>(<div key={j} className="skeleton" style={{height:14}}/>))}</div>))}</div>):(
            <table className="data-table">
              <thead><tr>{["TICKER","SHARES","AVG COST","CURRENT","MKT VALUE","P&L","RETURN","WEIGHT","TODAY",""].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
              <tbody>{(data?.holdings||[]).map((h:any)=>(
                <tr key={h.ticker}>
                  <td><span style={{fontWeight:800,fontSize:14}}>{h.ticker}</span></td>
                  <td style={{color:"var(--text-muted)"}}>{h.shares}</td>
                  <td style={{color:"var(--text-muted)"}}>${h.avg_cost?.toFixed(2)}</td>
                  <td style={{fontWeight:700}}>${h.current_price?.toFixed(2)}</td>
                  <td style={{fontWeight:700}}>${h.market_value?.toLocaleString("en-US",{minimumFractionDigits:2})}</td>
                  <td style={{color:pc(h.pnl),fontWeight:700}}>{h.pnl>=0?"+":""}{fm(h.pnl)}</td>
                  <td style={{color:pc(h.pnl_pct),fontWeight:700}}>{h.pnl_pct>=0?"+":""}{h.pnl_pct?.toFixed(2)}%</td>
                  <td><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{height:3,width:60,background:"rgba(255,255,255,0.06)",borderRadius:2}}><div style={{height:"100%",borderRadius:2,width:`${h.weight}%`,background:"var(--blue)"}}/></div><span style={{fontSize:11,color:"var(--text-dim)"}}>{h.weight}%</span></div></td>
                  <td style={{color:h.change_pct>=0?"var(--green)":"var(--red)",fontWeight:700,fontSize:12}}>{h.change_pct>=0?"+":""}{h.change_pct?.toFixed(2)}%</td>
                  <td><button onClick={()=>drop(h.ticker)} style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.15)",color:"var(--red)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:10,fontWeight:700}} onMouseEnter={e=>(e.currentTarget.style.background="rgba(248,113,113,0.15)")} onMouseLeave={e=>(e.currentTarget.style.background="rgba(248,113,113,0.06)")}>SELL</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
