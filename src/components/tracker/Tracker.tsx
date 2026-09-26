"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { CreatePlanDialog } from "@/components/plans/CreatePlanDialog";
import { usePlans } from "@/components/plans/usePlans";
import { addCalendarDays, canEditPlanDay, formatCompactDate, formatDayDate, getElapsedPlanDays, getPlanStartDate, getPlanTiming, isFuturePlanDay, localDateString } from "@/lib/plan-storage";
import type { Plan } from "@/types/plan";
import { ActivityRow } from "./ActivityRow";
import { StatsBar } from "./StatsBar";
import { TrackerHeader } from "./TrackerHeader";
import type { CellState, SelectedCell } from "./types";

function countStreak(plan: Plan, throughDay: number): number {
  if (plan.activities.length === 0) return 0;
  const complete = new Set(plan.entries.filter((entry) => entry.status === "complete").map((entry) => `${entry.activityId}:${entry.day}`));
  let streak = 0;
  for (let day = throughDay; day >= 1; day--) {
    if (!plan.activities.every((activity) => complete.has(`${activity.id}:${day}`))) break;
    streak += 1;
  }
  return streak;
}

export function Tracker({ planId }: { planId: string }) {
  const router = useRouter();
  const { plans, ready, updatePlan, addPlan, error } = usePlans();
  const plan = plans.find((item) => item.id === planId);
  const duration = plan?.duration ?? 30;
  const activities = plan?.activities ?? [];
  const entries = plan?.entries ?? [];
  const timing = plan ? getPlanTiming(plan) : null;
  const currentDay = timing?.currentDay ?? null;
  const [todayDate, setTodayDate] = useState(() => localDateString());
  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextDate = localDateString();
      setTodayDate((current) => current === nextDate ? current : nextDate);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const futureDays = useMemo(() => new Set(plan ? Array.from({ length: duration }, (_, index) => index + 1).filter((day) => isFuturePlanDay(plan, day)) : []), [duration, plan, todayDate]);
  const [selected, setSelected] = useState<SelectedCell>({ activityIndex: 0, dayIndex: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedDay, setRevealedDay] = useState<number | null>(null);

  const stateFor = useCallback((activityId: string, day: number): CellState => {
    return entries.find((entry) => entry.activityId === activityId && entry.day === day)?.status ?? "empty";
  }, [entries]);

  const setCell = useCallback((activityId: string, day: number, nextState: CellState) => {
    if (!plan) return;
    // Check at mutation time as well as presenting future cells as locked.
    if (!canEditPlanDay(plan, day)) return;
    updatePlan(plan.id, (current) => {
      const withoutCell = current.entries.filter((entry) => entry.activityId !== activityId || entry.day !== day);
      return {
        ...current,
        entries: nextState === "empty" ? withoutCell : [...withoutCell, { activityId, day, status: nextState }],
      };
    });
  }, [plan, updatePlan]);

  const cycleCell = useCallback((activityId: string, day: number) => {
    const current = stateFor(activityId, day);
    const nextState: CellState = current === "empty" ? "complete" : current === "complete" ? "incomplete" : "empty";
    setCell(activityId, day, nextState);
  }, [setCell, stateFor]);

  const stats = useMemo(() => {
    const todayCompleted = currentDay === null ? 0 : activities.filter((activity) => stateFor(activity.id, currentDay) === "complete").length;
    const elapsedDays = plan ? getElapsedPlanDays(plan) : 0;
    const validActivityIds = new Set(activities.map((activity) => activity.id));
    const completedCells = entries.filter((entry) => entry.status === "complete" && entry.day <= elapsedDays && validActivityIds.has(entry.activityId)).length;
    const totalCells = activities.length * elapsedDays;
    return {
      todayCompleted,
      overallPercent: totalCells ? Math.round((completedCells / totalCells) * 100) : 0,
      streakDays: plan ? countStreak(plan, timing?.status === "upcoming" ? 0 : currentDay ?? duration) : 0,
    };
  }, [activities, currentDay, duration, entries, plan, stateFor, timing]);

  function moveTo(next: SelectedCell) {
    setSelected(next);
    requestAnimationFrame(() => {
      const table = document.querySelector(".tracker-table");
      const row = table?.querySelectorAll("tbody tr")[next.activityIndex];
      row?.querySelectorAll<HTMLButtonElement>("[data-cell='true']")[next.dayIndex]?.focus();
    });
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!activities.length || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!(event.target instanceof HTMLButtonElement) || event.target.dataset.cell !== "true") return;
    const { activityIndex: row, dayIndex: column } = selected;
    let next: SelectedCell | null = null;
    if (event.key === "ArrowRight") next = { activityIndex: row, dayIndex: Math.min(duration - 1, column + 1) };
    else if (event.key === "ArrowLeft") next = { activityIndex: row, dayIndex: Math.max(0, column - 1) };
    else if (event.key === "ArrowDown") next = { activityIndex: Math.min(activities.length - 1, row + 1), dayIndex: column };
    else if (event.key === "ArrowUp") next = { activityIndex: Math.max(0, row - 1), dayIndex: column };
    else if (event.key === "Home") next = { activityIndex: row, dayIndex: 0 };
    else if (event.key === "End") next = { activityIndex: row, dayIndex: duration - 1 };

    if (next) {
      event.preventDefault();
      moveTo(next);
    } else if (event.key === "1") {
      event.preventDefault();
      setCell(activities[row].id, column + 1, "complete");
    } else if (event.key === "0") {
      event.preventDefault();
      setCell(activities[row].id, column + 1, "incomplete");
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      setCell(activities[row].id, column + 1, "empty");
    } else if (event.code === "Space") {
      event.preventDefault();
      cycleCell(activities[row].id, column + 1);
    }
  }

  async function createNewPlan(input: Parameters<typeof addPlan>[0]) {
    await addPlan(input);
    setCreateOpen(false);
    router.push("/dashboard");
  }

  if (!ready) {
    return <><AppHeader active="tracker" /><main className="main"><p className="plans-loading">LOADING LOCAL PLAN…</p></main></>;
  }

  if (!plan) {
    return (
      <>
        <AppHeader onNewPlan={() => setCreateOpen(true)} />
        <main className="main missing-plan">
          <div className="page-kicker"><span className="kicker-square" /> TRACKER NOT FOUND</div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <h1 className="hero-title">This plan is no longer available.</h1>
          <Link className="open-tracker-label" href="/dashboard">RETURN TO MY PLANS ↗</Link>
        </main>
        {createOpen && <CreatePlanDialog onClose={() => setCreateOpen(false)} onCreate={createNewPlan} />}
      </>
    );
  }

  return (
    <>
      <TrackerHeader onNewPlan={() => setCreateOpen(true)} plan={plan} />
      <main className="main tracker-main" style={{ paddingTop: 0 }}>
        <StatsBar todayCompleted={stats.todayCompleted} activityCount={activities.length} overallPercent={stats.overallPercent} streakDays={stats.streakDays} />
        <section aria-label="Habit tracker" className="tracker-section">
          <div className="tracker-toolbar">
            <div className="tracker-heading"><span aria-hidden="true" className="grid-symbol"><i /><i /><i /><i /></span> DAILY CHECK-IN</div>
            <div className="tracker-caption">{activities.length} ACTIVITIES <span aria-hidden="true">·</span> {duration} DAYS</div>
          </div>
          <div aria-label={`${duration} day habit tracker. Use arrow keys to navigate. Press 1 for complete, 0 for incomplete, Delete to clear, or Space to cycle.`} className="tracker-viewport" onKeyDown={handleGridKeyDown} role="group" tabIndex={-1}>
            <table className="tracker-table">
              <thead>
                <tr>
                  <th scope="col">ACTIVITY <span aria-hidden="true">/</span> DAY</th>
                  {Array.from({ length: duration }, (_, index) => {
                    const day = index + 1;
                    const date = addCalendarDays(getPlanStartDate(plan), day - 1);
                    const today = day === currentDay;
                    return <th className={`${today ? "day-today" : ""}${futureDays.has(day) ? " day-future-header" : ""}`} key={day} scope="col">
                      <button aria-label={`Day ${day}, ${formatCompactDate(date)}`} className="day-date-button" onClick={() => setRevealedDay((value) => value === day ? null : day)} title={formatCompactDate(date)} type="button">
                        <span className="day-label">{today && <span className="day-indicator" />} {String(day).padStart(2, "0")}</span>
                        <span className="day-date-caption">{formatDayDate(date)}</span>
                      </button>
                      {revealedDay === day && <span aria-live="polite" className="day-date-tooltip">{formatCompactDate(date)}</span>}
                    </th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {activities.map((activity, activityIndex) => (
                  <ActivityRow activity={activity} activityIndex={activityIndex} days={duration} futureDays={futureDays} key={activity.id} onCycle={cycleCell} onSelect={setSelected} selected={selected} stateFor={stateFor} />
                ))}
              </tbody>
            </table>
          </div>
          <div aria-label="Keyboard guide" className="tracker-legend">
            <span className="legend-item"><span className="legend-symbol empty">·</span> Empty</span>
            <span className="legend-item"><span className="legend-symbol">✓</span> Complete</span>
            <span className="legend-item"><span className="legend-symbol">×</span> Incomplete</span>
            <span className="keyboard-hint"><kbd className="keyboard-key">←</kbd><kbd className="keyboard-key">→</kbd><kbd className="keyboard-key">↑</kbd><kbd className="keyboard-key">↓</kbd> navigate <kbd className="keyboard-key">1</kbd> complete <kbd className="keyboard-key">0</kbd> incomplete <kbd className="keyboard-key">Space</kbd> cycle</span>
          </div>
        </section>
        {error && <p aria-live="polite" className="inline-error tracker-save-error" role="status">{error}</p>}
        <footer className="footer"><span>SHOW UP. KEEP TRACK.</span><span className="footer-code">TRACK / ACCOUNT SYSTEM / {plan.duration} DAY PLAN</span></footer>
      </main>
      {createOpen && <CreatePlanDialog onClose={() => setCreateOpen(false)} onCreate={createNewPlan} />}
    </>
  );
}
