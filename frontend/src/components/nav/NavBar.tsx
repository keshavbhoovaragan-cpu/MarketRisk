"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const NAV = [{label:"Markets",href:"/stocks"},{label:"Portfolio",href:"/portfolio"},{label:"Risk",href:"/risk"},{label:"Analytics",href:"/analytics"},{label:"Learn",href:"/learn"}];
export default function NavBar({ variant = "light" }: { variant?: "dark" | "light" }) {
  const path = usePathname();
  return (
    <header className={`site-nav ${variant === "light" ? "site-nav-light" : "site-nav-dark"}`}>
      <Link href="/" className="site-nav-brand">MarketRisk</Link>
      <nav className="site-nav-links">
        {NAV.map(n=>{
          const active=path===n.href;
          return <Link key={n.href} href={n.href} className={`site-nav-link${active ? " is-active" : ""}`}>{n.label}</Link>;
        })}
      </nav>
      <div className="site-nav-status">
        <span className="site-nav-dot" />
        <span>DELAYED DATA</span>
      </div>
    </header>
  );
}
