"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/nav/NavBar";
import { addWatchlistTicker, compareStocks, getMarketMovers, getScreener, getStockDetail, getWatchlist, removeWatchlistTicker } from "@/lib/api";

export default function StocksPage() {
  const [screener, setScreener] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [movers, setMovers] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [compare, setCompare] = useState<any[]>([]);
  const [tab, setTab] = useState<"watchlist"|"movers"|"screener"|"compare"|"detail">("watchlist");
  const [loading, setLoading] = useState(true);
  const [dt, setDt] = useState("");
  const [ct, setCt] = useState("AAPL,MSFT,GOOGL,NVDA");
  const [watchTicker, setWatchTicker] = useState("");
  useEffect(()=>{
    let active = true;
    const refresh = () => Promise.allSettled([getScreener(), getWatchlist(), getMarketMovers()]).then(([stocksResult, watchlistResult, moversResult])=>{
      if(!active)return;
      if(stocksResult.status==="fulfilled")setScreener(stocksResult.value.stocks||[]);
      if(watchlistResult.status==="fulfilled")setWatchlist(watchlistResult.value.watchlist||[]);
      if(moversResult.status==="fulfilled")setMovers(moversResult.value);
    }).finally(()=>{if(active)setLoading(false);});
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return ()=>{active=false;window.clearInterval(interval);};
  },[]);
  const loadDetail = () => { if (!dt) return; setLoading(true); setDetail(null); getStockDetail(dt.toUpperCase()).then(setDetail).finally(()=>setLoading(false)); };
  const loadCompare = () => { setLoading(true); compareStocks(ct).then(r=>setCompare(r.comparisons||[])).finally(()=>setLoading(false)); };
  const addToWatchlist = async () => { if (!watchTicker.trim()) return; await addWatchlistTicker(watchTicker); const result = await getWatchlist(); setWatchlist(result.watchlist||[]); setWatchTicker(""); };
  const removeFromWatchlist = async (ticker: string) => { await removeWatchlistTicker(ticker); const result = await getWatchlist(); setWatchlist(result.watchlist||[]); };
  const pc=(n:number)=>n>=0?"var(--green)":"var(--red)";
  const sc=(s:string)=>s==="BUY"?"#22c55e":s==="SELL"?"#f87171":"#fbbf24";
  const rc=(v:number)=>v<1.5?"#22c55e":v<2.5?"#fbbf24":"#f87171";
  return (
    <main className="workspace-page" style={{minHeight:"100vh"}}><NavBar/>
      <div className="section">
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,color:"rgba(251,191,36,0.6)",letterSpacing:"0.2em",fontWeight:700,marginBottom:8}}>MARKET INTELLIGENCE</div>
          <h1 style={{fontSize:36,fontWeight:900,lineHeight:1,letterSpacing:"-0.025em",marginBottom:8,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Stocks</h1>
          <p style={{color:"var(--text-muted)",fontSize:14}}>Market screener · Stock comparison · RSI · Moving averages · Fundamentals</p>
        </div>
        <div className="workspace-tabs">
          {(["watchlist","movers","screener","compare","detail"] as const).map(t=>(<button className={`workspace-tab${tab===t?" is-active":""}`} key={t} onClick={()=>setTab(t)}>{t === "detail" ? "Analyze" : t}</button>))}
        </div>
        {tab==="watchlist"&&(
          <div className="card marketwatch-panel" style={{overflow:"hidden"}}>
            <div className="table-header"><span style={{fontWeight:700,fontSize:13}}>My Watchlist</span><span style={{fontSize:10,color:"var(--text-dim)"}}>YOUR SAVED MARKETS · PROVIDER-TIMESTAMPED</span></div>
            <div className="watchlist-add"><input aria-label="Ticker to watch" value={watchTicker} onChange={event=>setWatchTicker(event.target.value.toUpperCase())} placeholder="Add ticker, e.g. AAPL" maxLength={15} onKeyDown={event=>event.key==="Enter"&&addToWatchlist()}/><button onClick={addToWatchlist} disabled={!watchTicker.trim()}>Add to watchlist</button></div>
            {loading?<div className="skeleton" style={{height:140,margin:14}}/>:watchlist.length?<div className="market-table-wrap"><table className="data-table"><thead><tr>{["TICKER","LAST","CHANGE","VOLUME","QUOTE SOURCE","BAR TIME",""].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{watchlist.map((item:any)=><tr key={item.ticker}><td><strong>{item.ticker}</strong></td><td>{item.price===undefined?"—":`$${item.price.toFixed(2)}`}</td><td style={{color:pc(item.change_pct),fontWeight:700}}>{item.change_pct===undefined?"—":`${item.change_pct>=0?"+":""}${item.change_pct.toFixed(2)}%`}</td><td>{item.volume>=1e6?`${(item.volume/1e6).toFixed(1)}M`:item.volume?.toLocaleString()??"—"}</td><td>{item.source??"Yahoo Finance via yfinance"}</td><td>{item.quote_as_of?new Date(item.quote_as_of*1000).toLocaleString():"Unavailable"}</td><td><button className="remove-watch" onClick={()=>removeFromWatchlist(item.ticker)} aria-label={`Remove ${item.ticker}`}>×</button></td></tr>)}</tbody></table></div>:<div className="watchlist-empty">Your watchlist is empty. Add symbols to follow their latest available prices.</div>}
            <p className="market-data-notice">Yahoo Finance via yfinance is not a guaranteed real-time feed. Verify exchange/provider timestamps; quotes may be delayed or stale.</p>
          </div>
        )}
        {tab==="movers"&&(
          <div className="movers-grid">
            {[{title:"Top gainers",items:movers?.gainers},{title:"Top decliners",items:movers?.losers},{title:"Most active",items:movers?.most_active}].map(group=><section className="card movers-panel" key={group.title}><div className="table-header">{group.title}</div>{(group.items||[]).map((item:any)=><button className="mover-row" key={`${group.title}-${item.ticker}`} onClick={()=>{setDt(item.ticker);setTab("detail");}}><strong>{item.ticker}</strong><span>{item.price===undefined?"—":`$${item.price.toFixed(2)}`}</span><span style={{color:pc(item.change_pct)}}>{item.change_pct===undefined?"—":`${item.change_pct>=0?"+":""}${item.change_pct.toFixed(2)}%`}</span></button>)}</section>)}
          </div>
        )}
        {tab==="screener"&&(
          <div className="card" style={{overflow:"hidden"}}>
            <div className="table-header"><span style={{fontWeight:700,fontSize:13}}>Market Screener</span><span style={{fontSize:10,color:"var(--text-dim)"}}>LATEST AVAILABLE · CLICK ROW TO ANALYZE</span></div>
            {loading?(<div style={{padding:20}}>{Array.from({length:8}).map((_,i)=>(<div key={i} className="skeleton" style={{height:40,marginBottom:8,borderRadius:8}}/>))}</div>):(
              <table className="data-table">
                <thead><tr>{["TICKER","PRICE","CHANGE","VOLUME","MKT CAP","52W HIGH","52W LOW","P/E"].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
                <tbody>{screener.map((s:any)=>(<tr key={s.ticker} style={{cursor:"pointer"}} onClick={()=>{setDt(s.ticker);setTab("detail");}}>
                  <td><span style={{fontWeight:800,fontSize:14}}>{s.ticker}</span></td>
                  <td style={{fontWeight:700}}>${s.price?.toFixed(2)}</td>
                  <td style={{color:pc(s.change_pct),fontWeight:700}}>{s.change_pct>=0?"+":""}{s.change_pct?.toFixed(2)}%</td>
                  <td style={{color:"var(--text-muted)",fontSize:12}}>{s.volume>=1e6?`${(s.volume/1e6).toFixed(1)}M`:s.volume?.toLocaleString()}</td>
                  <td style={{color:"var(--text-muted)",fontSize:12}}>{s.market_cap>=1e12?`$${(s.market_cap/1e12).toFixed(1)}T`:s.market_cap>=1e9?`$${(s.market_cap/1e9).toFixed(1)}B`:"—"}</td>
                  <td style={{color:"var(--text-muted)",fontSize:12}}>{s.week52_high?`$${s.week52_high?.toFixed(2)}`:"—"}</td>
                  <td style={{color:"var(--text-muted)",fontSize:12}}>{s.week52_low?`$${s.week52_low?.toFixed(2)}`:"—"}</td>
                  <td style={{color:"var(--text-muted)",fontSize:12}}>{s.pe_ratio?s.pe_ratio?.toFixed(1):"—"}</td>
                </tr>))}</tbody>
              </table>
            )}
          </div>
        )}
        {tab==="compare"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
              <input value={ct} onChange={e=>setCt(e.target.value)} placeholder="AAPL,MSFT,GOOGL,NVDA" style={{flex:1,padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
              <button onClick={loadCompare} style={{padding:"10px 20px",borderRadius:8,border:"none",background:"var(--amber)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:12,flexShrink:0}}>Compare</button>
            </div>
            {compare.length>0&&(
              <div className="card" style={{overflow:"hidden"}}>
                <div className="table-header"><span style={{fontWeight:700,fontSize:13}}>Comparison</span><span style={{fontSize:10,color:"var(--text-dim)"}}>1-YEAR PERFORMANCE</span></div>
                <table className="data-table">
                  <thead><tr>{["TICKER","TOTAL RETURN","VOLATILITY","SHARPE","VaR 95%","BETA","START","END"].map(h=>(<th key={h}>{h}</th>))}</tr></thead>
                  <tbody>{compare.sort((a,b)=>b.total_return_pct-a.total_return_pct).map((s:any)=>(<tr key={s.ticker}>
                    <td><span style={{fontWeight:800,fontSize:14}}>{s.ticker}</span></td>
                    <td style={{color:pc(s.total_return_pct),fontWeight:800,fontSize:15}}>{s.total_return_pct>=0?"+":""}{s.total_return_pct?.toFixed(2)}%</td>
                    <td style={{color:"var(--text-muted)"}}>{s.volatility?.toFixed(1)}%</td>
                    <td style={{color:s.sharpe>1?"#22c55e":s.sharpe>0?"#fbbf24":"#f87171",fontWeight:700}}>{s.sharpe?.toFixed(2)}</td>
                    <td style={{color:rc(s.var_95),fontWeight:700}}>{s.var_95?.toFixed(2)}%</td>
                    <td style={{color:"var(--text-muted)"}}>{s.beta?.toFixed(2)}</td>
                    <td style={{color:"var(--text-dim)",fontSize:12}}>${s.start_price?.toFixed(2)}</td>
                    <td style={{color:"var(--text)",fontWeight:700}}>${s.end_price?.toFixed(2)}</td>
                  </tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab==="detail"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
              <input value={dt} onChange={e=>setDt(e.target.value.toUpperCase())} placeholder="AAPL" style={{width:120,padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:13,outline:"none",textTransform:"uppercase"}} onKeyDown={e=>e.key==="Enter"&&loadDetail()}/>
              <button onClick={loadDetail} style={{padding:"10px 20px",borderRadius:8,border:"none",background:"var(--amber)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:12}}>Analyze</button>
            </div>
            {loading&&<div className="skeleton" style={{height:300,borderRadius:14}}/>}
            {detail&&!loading&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div className="card" style={{padding:"20px 24px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
                    <div><div style={{fontSize:24,fontWeight:900,marginBottom:4}}>{detail.ticker}</div><div style={{color:"var(--text-muted)",fontSize:14,marginBottom:4}}>{detail.name}</div><div style={{fontSize:12,color:"var(--text-dim)"}}>{detail.sector} · {detail.industry}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:32,fontWeight:900,letterSpacing:"-0.02em"}}>${detail.current_price?.toFixed(2)}</div><span style={{fontSize:14,fontWeight:700,padding:"4px 12px",borderRadius:20,background:sc(detail.signal)+"15",color:sc(detail.signal),border:`1px solid ${sc(detail.signal)}30`}}>{detail.signal}</span><div style={{fontSize:9,color:"var(--text-dim)",marginTop:6}}>Rule-based technical indicator · not a recommendation</div><div style={{fontSize:8,color:"var(--text-dim)",marginTop:5}}>{detail.quote_source} · bar {detail.quote_as_of?new Date(detail.quote_as_of*1000).toLocaleString():"timestamp unavailable"}</div></div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                  {[{label:"RSI (14)",value:detail.rsi?.toFixed(1),color:detail.rsi>70?"#f87171":detail.rsi<30?"#22c55e":"#fbbf24",sub:detail.rsi>70?"Overbought":detail.rsi<30?"Oversold":"Neutral"},{label:"SMA 50",value:detail.sma_50?`$${detail.sma_50?.toFixed(2)}`:"—",color:detail.current_price>detail.sma_50?"#22c55e":"#f87171",sub:detail.current_price>detail.sma_50?"Above SMA":"Below SMA"},{label:"VaR 95%",value:`${detail.var_95}%`,color:rc(detail.var_95),sub:"Daily max loss"},{label:"Sharpe",value:detail.sharpe?.toFixed(2),color:detail.sharpe>1?"#22c55e":detail.sharpe>0?"#fbbf24":"#f87171",sub:"Risk-adj. return"},{label:"Beta",value:detail.beta?.toFixed(2),color:"var(--blue)",sub:"vs S&P 500"},{label:"P/E Ratio",value:detail.pe_ratio?.toFixed(1)||"—",color:"var(--text)",sub:"Trailing"},{label:"Volatility",value:`${detail.volatility?.toFixed(1)}%`,color:detail.volatility>40?"#f87171":detail.volatility>20?"#fbbf24":"#22c55e",sub:"Annualized"},{label:"Div. Yield",value:detail.dividend_yield?`${(detail.dividend_yield*100).toFixed(2)}%`:"—",color:"#a78bfa",sub:"Annual"}].map(({label,value,color,sub})=>(
                    <div key={label} className="card" style={{padding:"14px 16px"}}>
                      <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:6,fontWeight:700,textTransform:"uppercase"}}>{label}</div>
                      <div style={{fontSize:20,fontWeight:900,color,lineHeight:1,marginBottom:4}}>{value}</div>
                      <div style={{fontSize:10,color:"var(--text-dim)"}}>{sub}</div>
                    </div>
                  ))}
                </div>
                {detail.description&&(<div className="card" style={{padding:"18px 20px"}}><div style={{fontWeight:700,fontSize:13,marginBottom:8}}>About</div><p style={{color:"var(--text-muted)",fontSize:13,lineHeight:1.75}}>{detail.description}</p></div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
