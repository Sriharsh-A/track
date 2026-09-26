"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { CreatePlanDialog } from "./CreatePlanDialog";
import { DeletePlanDialog } from "./DeletePlanDialog";
import { EditPlanDialog } from "./EditPlanDialog";
import { usePlans } from "./usePlans";
import { getCompletionPercent, getPlanTiming } from "@/lib/plan-storage";
import type { CreatePlanInput, Plan } from "@/types/plan";

function sortPlans(plans: Plan[]) {
  return [...plans].sort((a, b) => {
    const timingA = getPlanTiming(a);
    const timingB = getPlanTiming(b);
    const priority = (status: typeof timingA.status) => status === "active" ? 0 : status === "upcoming" ? 1 : 2;
    const priorityDifference = priority(timingA.status) - priority(timingB.status);
    if (priorityDifference) return priorityDifference;
    if (timingA.status === "active" && timingB.status === "active") return (timingB.currentDay ?? 0) - (timingA.currentDay ?? 0);
    if (timingA.status === "upcoming" && timingB.status === "upcoming") return timingA.daysUntilStart - timingB.daysUntilStart;
    return timingB.endDate.localeCompare(timingA.endDate);
  });
}

function PlanModule({ plan, onEdit, onArchive, onDelete, archivedView }: {
  plan: Plan; onEdit: (plan: Plan) => void; onArchive: (plan: Plan, archived: boolean) => void;
  onDelete: (plan: Plan) => void; archivedView: boolean;
}) {
  const percent = getCompletionPercent(plan);
  const timing = getPlanTiming(plan);
  const status = timing.status === "upcoming"
    ? `STARTS IN ${timing.daysUntilStart} ${timing.daysUntilStart === 1 ? "DAY" : "DAYS"}`
    : timing.status === "complete" ? "PLAN COMPLETE" : `DAY ${String(timing.currentDay).padStart(2, "0")} / ${plan.duration}`;

  return (
    <article className="plan-module managed-plan-module">
      <Link aria-label={`Open tracker for ${plan.name}`} className="plan-module-main" href={`/tracker/${plan.id}`}>
        <div className="plan-module-top"><span className="module-number">PLAN / {plan.id.slice(0, 4).toUpperCase()}</span><span className="module-duration">{plan.duration} DAYS</span></div>
        <h2 className="plan-module-title">{plan.name}</h2>
        <div className="plan-module-meta"><span>{status}</span><span>{plan.activities.length} ACTIVITIES</span></div>
        <div aria-label={`${percent}% complete`} className="plan-progress"><span style={{ width: `${percent}%` }} /></div>
        <div className="plan-module-bottom"><span className="plan-percent">{percent}<span>%</span></span><span className="open-tracker-label">OPEN TRACKER <span aria-hidden="true">↗</span></span></div>
      </Link>
      <div className="plan-management-actions">
        {!archivedView && <button aria-label={`Edit ${plan.name}`} onClick={() => onEdit(plan)} type="button">EDIT</button>}
        <button aria-label={`${archivedView ? "Restore" : "Archive"} ${plan.name}`} onClick={() => onArchive(plan, !archivedView)} type="button">{archivedView ? "RESTORE" : "ARCHIVE"}</button>
        <button aria-label={`Delete ${plan.name}`} onClick={() => onDelete(plan)} type="button">DELETE</button>
      </div>
    </article>
  );
}

export function Dashboard() {
  const { plans, ready, addPlan, editPlan, archivePlan, removePlan, error, reload, migrationPlans, migrating, importMigration, dismissMigration } = usePlans();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [archivedView, setArchivedView] = useState(false);
  const visiblePlans = useMemo(() => sortPlans(plans.filter((plan) => plan.archived === archivedView)), [plans, archivedView]);
  const activeCount = plans.filter((plan) => !plan.archived).length;

  async function create(input: CreatePlanInput) {
    await addPlan(input);
    setCreateOpen(false);
  }
  async function saveEdit(input: Parameters<typeof editPlan>[1]) {
    if (!editing) return;
    await editPlan(editing.id, input);
    setEditing(null);
  }
  async function confirmDelete() {
    if (!deleting) return;
    await removePlan(deleting.id);
    setDeleting(null);
  }

  return (
    <>
      <AppHeader active="plans" onNewPlan={() => setCreateOpen(true)} />
      <main className="main dashboard-main">
        <div className="page-kicker"><span className="kicker-square" /> PERSONAL TRACKING SYSTEM</div>
        <section className="dashboard-heading">
          <div><p className="hero-eyebrow">TRACK <span aria-hidden="true">/</span> YOUR SYSTEMS</p><h1 className="hero-title">MY PLANS</h1></div>
          <div className="dashboard-tools"><span className="dashboard-count">{ready ? String(activeCount).padStart(2, "0") : "—"} <span>ACTIVE PLANS</span></span><button aria-pressed={archivedView} className="archived-toggle" onClick={() => setArchivedView((value) => !value)} type="button">{archivedView ? "ACTIVE" : "ARCHIVED"} <span>{plans.filter((plan) => plan.archived).length.toString().padStart(2, "0")}</span></button></div>
        </section>

        {error && <p className="inline-error" role="alert">{error}</p>}
        {migrationPlans.length > 0 && <section aria-label="Import local plans" className="migration-prompt">
          <div><p className="dialog-kicker"><span className="kicker-square" /> LOCAL PLANS FOUND</p><p>Move your existing plans to your TRACK account?</p><small>{migrationPlans.length} PLANS · ACTIVITIES AND COMPLETION STATES INCLUDED</small></div>
          <div className="migration-actions"><button className="create-plan-button" disabled={migrating} onClick={() => void importMigration()} type="button">{migrating ? "IMPORTING..." : "IMPORT"}</button><button className="migration-dismiss" disabled={migrating} onClick={dismissMigration} type="button">NOT NOW</button></div>
        </section>}

        {!ready ? <div aria-live="polite" className="plans-loading">CONNECTING TO TRACK…</div>
          : error && plans.length === 0 ? <section className="empty-plans"><p className="empty-state-kicker">ACCOUNT CONNECTION</p><h2>PLANS UNAVAILABLE</h2><p className="empty-plans-copy">Your plans could not be loaded right now.</p><button className="create-plan-button" onClick={() => void reload()} type="button">RETRY</button></section>
            : visiblePlans.length === 0 ? <section className="empty-plans">
              <span aria-hidden="true" className="empty-plans-symbol"><i /><i /><i /><i /></span><p className="empty-state-kicker">SYSTEM STATUS <span aria-hidden="true">/</span> READY</p>
              <h2>{archivedView ? "NO ARCHIVED PLANS" : "NO ACTIVE PLANS"}</h2><p className="empty-plans-copy">{archivedView ? "Archived plans will appear here." : "Create your first tracking system."}</p>
              {!archivedView && <button className="create-plan-button" onClick={() => setCreateOpen(true)} type="button">+ NEW PLAN</button>}
            </section> : <section aria-label={archivedView ? "Archived plans" : "My plans"} className="plan-grid">
              {visiblePlans.map((plan) => <PlanModule archivedView={archivedView} key={plan.id} onArchive={(item, archived) => void archivePlan(item.id, archived)} onDelete={setDeleting} onEdit={setEditing} plan={plan} />)}
            </section>}
        <footer className="footer"><span>SHOW UP. KEEP TRACK.</span><span className="footer-code">TRACK / {ready ? `${String(activeCount).padStart(2, "0")} ACTIVE PLANS` : "ACCOUNT SYSTEM"}</span></footer>
      </main>
      {createOpen && <CreatePlanDialog onClose={() => setCreateOpen(false)} onCreate={create} />}
      {editing && <EditPlanDialog key={editing.id} onClose={() => setEditing(null)} onSave={saveEdit} plan={editing} />}
      {deleting && <DeletePlanDialog onClose={() => setDeleting(null)} onDelete={confirmDelete} plan={deleting} />}
    </>
  );
}
