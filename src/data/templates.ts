import type { PlanDuration } from "@/types/plan";

export interface PlanTemplate {
  id: string;
  name: string;
  duration: PlanDuration;
  activities: string[];
}

export const planTemplates: PlanTemplate[] = [
  {
    id: "weekly-routine",
    name: "WEEKLY ROUTINE",
    duration: 7,
    activities: ["Wake up by 8:00 AM", "Drink 1L water", "Plan the day", "Move for 30 minutes", "Read for 20 minutes", "Sleep before target time"],
  },
  {
    id: "30-day-reset",
    name: "30 DAY RESET",
    duration: 30,
    activities: ["Wake up by 8:00 AM", "Drink 2L water", "Workout", "10,000 steps", "Study for 30 minutes", "Eat within calorie target", "No unnecessary spending", "Sleep before target time"],
  },
  {
    id: "90-day-lock-in",
    name: "90 DAY LOCK-IN",
    duration: 90,
    activities: ["Wake up by 8:00 AM", "Drink 2L water", "Deep work for 2 hours", "Workout", "10,000 steps", "Read for 30 minutes", "Track spending", "Sleep before target time"],
  },
  {
    id: "fitness",
    name: "FITNESS",
    duration: 30,
    activities: ["Complete planned workout", "10,000 steps", "Drink 2L water", "Eat within calorie target", "Stretch for 10 minutes", "Sleep for 8 hours"],
  },
  {
    id: "study",
    name: "STUDY",
    duration: 30,
    activities: ["Study for 30 minutes", "Complete one focused session", "Review notes", "Read 10 pages", "Plan tomorrow's study"],
  },
  {
    id: "productivity",
    name: "PRODUCTIVITY",
    duration: 30,
    activities: ["Plan the day", "Complete top priority", "Deep work for 2 hours", "Clear inbox", "Prepare for tomorrow", "Sleep before target time"],
  },
];
