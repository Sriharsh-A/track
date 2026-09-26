import type { CreatePlanInput, EntryStatus, Plan, PlanDuration } from "@/types/plan";

export const PLAN_STORAGE_KEY = "track:plans:v1";

const durations: PlanDuration[] = [7, 30, 90];
const statuses: EntryStatus[] = ["empty", "complete", "incomplete"];

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<Plan>;
  return typeof plan.id === "string"
    && typeof plan.name === "string"
    && durations.includes(plan.duration as PlanDuration)
    && typeof plan.createdAt === "string"
    && Array.isArray(plan.activities)
    && Array.isArray(plan.entries)
    && plan.activities.every((activity) => activity && typeof activity.id === "string" && typeof activity.name === "string" && typeof activity.order === "number")
    && plan.entries.every((entry) => entry && typeof entry.activityId === "string" && typeof entry.day === "number" && statuses.includes(entry.status));
}

export function readPlans(): Plan[] {
  try {
    const stored = window.localStorage.getItem(PLAN_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isPlan).map((plan) => ({
      ...plan,
      startDate: typeof plan.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(plan.startDate) ? plan.startDate : plan.createdAt.slice(0, 10),
      archived: plan.archived === true,
    })) : [];
  } catch {
    return [];
  }
}

export function writePlans(plans: Plan[]): void {
  try {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // Keep the current session usable if browser storage is unavailable.
  }
}

export function createPlan(input: CreatePlanInput): Plan {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: input.name.trim(),
    duration: input.duration,
    startDate: input.startDate,
    archived: false,
    activities: input.activities.map((activity, order) => ({ ...activity, name: activity.name.trim(), order })),
    entries: [],
    createdAt: new Date().toISOString(),
  };
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPlanStartDate(plan: Pick<Plan, "startDate" | "createdAt">): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(plan.startDate) ? plan.startDate : plan.createdAt.slice(0, 10);
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function calendarDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getPlanTiming(plan: Pick<Plan, "startDate" | "createdAt" | "duration">, now = new Date()) {
  const startDate = getPlanStartDate(plan);
  const today = localDateString(now);
  const startOffset = calendarDay(today) - calendarDay(startDate);
  const endDate = addCalendarDays(startDate, plan.duration - 1);
  if (startOffset < 0) return { status: "upcoming" as const, currentDay: null, daysUntilStart: -startOffset, startDate, endDate };
  if (startOffset >= plan.duration) return { status: "complete" as const, currentDay: null, daysUntilStart: 0, startDate, endDate };
  return { status: "active" as const, currentDay: startOffset + 1, daysUntilStart: 0, startDate, endDate };
}

export function getCurrentDay(plan: Plan, now = new Date()): number {
  const timing = getPlanTiming(plan, now);
  return timing.currentDay ?? (timing.status === "upcoming" ? 1 : plan.duration);
}

export function formatCompactDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

export function formatPlanDateRange(plan: Pick<Plan, "startDate" | "createdAt" | "duration">): string {
  const { startDate, endDate } = getPlanTiming(plan);
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const monthDay = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).toUpperCase();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  return startYear === endYear
    ? `${monthDay(start)} — ${monthDay(end)}, ${endYear}`
    : `${monthDay(start)}, ${startYear} — ${monthDay(end)}, ${endYear}`;
}

export function isFuturePlanDay(plan: Pick<Plan, "startDate" | "createdAt">, day: number, now = new Date()): boolean {
  const date = addCalendarDays(getPlanStartDate(plan), day - 1);
  return calendarDay(date) > calendarDay(localDateString(now));
}

export function getCompletionPercent(plan: Plan): number {
  const total = plan.activities.length * plan.duration;
  if (total === 0) return 0;
  const complete = plan.entries.filter((entry) => entry.status === "complete").length;
  return Math.round((complete / total) * 100);
}
