"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AppHeaderProps {
  onNewPlan?: () => void;
  active?: "plans" | "tracker";
}

export function AppHeader({ onNewPlan, active }: AppHeaderProps) {
  const router = useRouter();
  async function logout() {
    try { await createClient().auth.signOut(); } finally { router.replace("/login"); router.refresh(); }
  }

  return (
    <header className="topbar">
      <Link className="brand" href="/dashboard" aria-label="TRACK — My plans">
        <svg className="brand-mark" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 1.65 18.35 10 10 18.35 1.65 10 10 1.65Z" stroke="#c7c7c7" strokeWidth="1.35" />
          <path d="M10 6.3 13.7 10 10 13.7 6.3 10 10 6.3Z" stroke="#777" strokeWidth="1" />
        </svg>
        <span className="brand-name">TRACK</span>
      </Link>
      <nav className="app-nav" aria-label="Main navigation">
        <Link className={`nav-link${active === "plans" ? " is-active" : ""}`} href="/dashboard">MY PLANS</Link>
        {onNewPlan && <button className="new-plan-button" onClick={onNewPlan} type="button">+ NEW PLAN</button>}
        <span className="topbar-meta"><span className="status-dot" /> PERSONAL SYSTEM</span>
        <button className="logout-button" onClick={() => void logout()} type="button">LOG OUT</button>
      </nav>
    </header>
  );
}
