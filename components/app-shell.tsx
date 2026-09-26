"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, ChartNoAxesColumnIncreasing, ClipboardList, CreditCard, LayoutDashboard, LogOut, MoreHorizontal, Package, Search, Settings, Table2, UserRound, UsersRound, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/brand";
import { LiveClock } from "@/components/live-clock";
import type { Club, Profile } from "@/types/domain";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const nav = [
  ["/dashboard", "Dashboard", LayoutDashboard], ["/tables", "Tables", Table2], ["/pos", "POS", CreditCard],
  ["/bookings", "Bookings", CalendarDays], ["/orders", "Orders", ClipboardList], ["/inventory", "Inventory", Package],
  ["/customers", "Customers", UsersRound], ["/reports", "Reports", ChartNoAxesColumnIncreasing], ["/staff", "Staff", UserRound],
  ["/expenses", "Expenses", WalletCards], ["/settings", "Settings", Settings],
] as const;

const mobile = [["/dashboard","Home",LayoutDashboard],["/tables","Tables",Table2],["/pos","POS",CreditCard],["/orders","Orders",ClipboardList],["/settings","More",MoreHorizontal]] as const;

export function AppShell({ profile, club, children }: { profile: Profile; club: Club; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = profile.full_name.charAt(0).toUpperCase();
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="app-shell">
      <RealtimeRefresh clubId={club.id}/>
      <aside className="sidebar">
        <Brand />
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(([href,label,Icon]) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "active" : ""}`}><Icon size={19}/><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-foot">
          <div className="role-chip"><span className="avatar">{initial}</span><span><strong style={{color:"white"}}>{profile.full_name}</strong><br/>{profile.role}</span><button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={17}/></button></div>
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
        <nav className="mobile-nav" aria-label="Mobile navigation">{mobile.map(([href,label,Icon]) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={21}/><span>{label}</span></Link>)}</nav>
      </main>
    </div>
  );
}
