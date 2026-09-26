import { AppHeader } from "@/components/AppHeader";
import { formatPlanDateRange, getPlanTiming } from "@/lib/plan-storage";
import type { Plan } from "@/types/plan";

interface TrackerHeaderProps {
  plan: Plan;
  onNewPlan: () => void;
}

export function TrackerHeader({ plan, onNewPlan }: TrackerHeaderProps) {
  const timing = getPlanTiming(plan);
  return (
    <>
      <AppHeader active="tracker" onNewPlan={onNewPlan} />
      <div className="main">
        <div className="page-kicker"><span className="kicker-square" /> {plan.duration} DAY PLAN</div>
        <section className="hero" aria-label="Current plan">
          <div className="hero-copy">
            <p className="hero-eyebrow">{formatPlanDateRange(plan)} <span aria-hidden="true">/</span> {plan.activities.length} ACTIVITIES</p>
            <h1 className="hero-title">{plan.name}</h1>
          </div>
          <div className="plan-chip">{timing.status === "active" ? <><strong>DAY {String(timing.currentDay).padStart(2, "0")}</strong><span className="plan-chip-sep">/</span> {plan.duration} DAYS</> : timing.status === "upcoming" ? <strong>STARTS IN {timing.daysUntilStart} {timing.daysUntilStart === 1 ? "DAY" : "DAYS"}</strong> : <strong>PLAN COMPLETE</strong>}</div>
        </section>
      </div>
    </>
  );
}
