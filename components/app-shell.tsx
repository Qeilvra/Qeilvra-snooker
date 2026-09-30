"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, ChartNoAxesColumnIncreasing, ClipboardList, CreditCard, LayoutDashboard, LogOut, MoreHorizontal, Package, Search, Settings, Table2, UserRound, UsersRound, WalletCards } from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveClock } from "@/components/live-clock";
import type { Club, Profile } from "@/types/domain";

const RealtimeRefresh = dynamic(() => import("@/components/realtime-refresh").then((module) => module.RealtimeRefresh), { ssr: false });

const nav = [
  ["/dashboard", "Dashboard", LayoutDashboard], ["/tables", "Tables", Table2], ["/pos", "POS", CreditCard],
  ["/bookings", "Bookings", CalendarDays], ["/orders", "Orders", ClipboardList], ["/inventory", "Inventory", Package],
  ["/customers", "Customers", UsersRound], ["/reports", "Reports", ChartNoAxesColumnIncreasing], ["/staff", "Staff", UserRound],
  ["/expenses", "Expenses", WalletCards], ["/settings", "Settings", Settings],
] as const;

const mobile = [["/dashboard","Home",LayoutDashboard],["/tables","Tables",Table2],["/pos","POS",CreditCard],["/orders","Orders",ClipboardList]] as const;

export function AppShell({ profile, club, children }: { profile: Profile; club: Club; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const initial = profile.full_name.charAt(0).toUpperCase();
  const mobileMoreActive = !mobile.some(([href]) => pathname === href);
  const realtimeEnabled = ["/dashboard", "/tables", "/pos", "/bookings", "/orders", "/inventory", "/reports", "/notifications"].includes(pathname);
  async function logout() {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="app-shell">
      {realtimeEnabled && <RealtimeRefresh clubId={club.id}/>}
      <aside className="sidebar">
        <Brand />
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(([href,label,Icon]) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "active" : ""}`}><Icon size={19}/><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-foot">
          <div className="role-chip"><span className="avatar">{initial}</span><span><strong style={{color:"white"}}>{profile.full_name}</strong><br/>{profile.role}</span><button className="icon-button" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={17}/></button></div>
        </div>
      </aside>
      <main className="app-body">
        <header className="topbar">
          <form className="global-search" action="/search"><Search size={19}/><input name="q" type="search" placeholder="Search tables, bookings, customers…" aria-label="Global search"/></form>
          <div className="topbar-spacer" />
          <LiveClock timezone={club.timezone}/>
          <Link href="/notifications" className="icon-button" aria-label="Notifications"><Bell size={21}/><span className="notification-dot"/></Link>
          <span className="avatar">{initial}</span>
          <div style={{fontSize:12}}><strong>{profile.full_name}</strong><br/><span style={{color:"var(--muted)",textTransform:"capitalize"}}>{profile.role}</span></div>
        </header>
        <header className="mobile-topbar"><Brand/><Link href="/notifications" className="icon-button" aria-label="Notifications"><Bell size={21}/><span className="notification-dot"/></Link><span className="avatar">{initial}</span></header>
        <div className="content">{children}</div>
        {mobileMenuOpen && <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />}
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {mobile.map(([href,label,Icon]) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={21}/><span>{label}</span></Link>)}
          <button type="button" className={mobileMoreActive ? "active" : ""} onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-controls="mobile-menu"><MoreHorizontal size={21}/><span>More</span></button>
        </nav>
        {mobileMenuOpen && <section className="mobile-menu" id="mobile-menu" aria-label="More navigation"><div className="mobile-menu-head"><strong>More</strong><button type="button" className="icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button></div><div className="mobile-menu-links">{nav.map(([href,label,Icon]) => <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className={pathname === href ? "active" : ""}><Icon size={20}/><span>{label}</span></Link>)}<button type="button" className="mobile-menu-logout" onClick={logout}><LogOut size={20}/><span>Log out</span></button></div></section>}
      </main>
    </div>
  );
}
