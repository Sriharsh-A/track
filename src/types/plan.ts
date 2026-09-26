export type PlanDuration = 7 | 30 | 90;

export type EntryStatus = "empty" | "complete" | "incomplete";

export interface Activity {
  id: string;
  name: string;
  order: number;
}

export interface DailyEntry {
  activityId: string;
  day: number;
  status: EntryStatus;
}

export interface Plan {
  id: string;
  name: string;
  duration: PlanDuration;
  startDate: string;
  archived: boolean;
  activities: Activity[];
  entries: DailyEntry[];
  createdAt: string;
}

export interface CreatePlanInput {
  name: string;
  duration: PlanDuration;
  startDate: string;
  activities: Activity[];
}

export type UpdatePlanInput = Pick<Plan, "name" | "startDate" | "activities">;
