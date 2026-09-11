"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const NAV = [{label:"Dashboard",href:"/"},{label:"Portfolio",href:"/portfolio"},{label:"Risk",href:"/risk"},{label:"Analytics",href:"/analytics"},{label:"Stocks",href:"/stocks"}];
export default function NavBar() {
  const path = usePathname();
  return (
    <header style={{height:52,display:"flex",alignItems:"center",padding:"0 24px",background:"rgba(3,5,9,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",position:"sticky",top:0,zIndex:50}}>
      <Link href="/" style={{fontSize:16,fontWeight:900,textDecoration:"none",marginRight:28,flexShrink:0,background:"linear-gradient(135deg,#22c55e,#22d3ee,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-0.03em"}}>MarketRisk</Link>
      <nav style={{display:"flex",gap:1,flex:1}}>
        {NAV.map(n=>{const active=path===n.href;return(<Link key={n.href} href={n.href} style={{padding:"4px 12px",borderRadius:7,fontSize:12,fontWeight:600,color:active?"#fff":"rgba(255,255,255,0.35)",textDecoration:"none",whiteSpace:"nowrap",flexShrink:0,background:active?"rgba(34,197,94,0.1)":"transparent",border:active?"1px solid rgba(34,197,94,0.2)":"1px solid transparent",transition:"all 0.12s"}}>{n.label}</Link>);})}
      </nav>
      <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
        <span style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",display:"block",animation:"pulse-glow 2s infinite"}}/>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontWeight:700,letterSpacing:"0.12em"}}>LIVE</span>
      </div>
    </header>
  );
}
