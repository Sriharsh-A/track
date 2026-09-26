import type { Activity } from "@/types/plan";

export const sampleActivities: Activity[] = [
  { id: "wake-by-8", name: "Wake up by 8:00 AM", order: 0 },
  { id: "water-1l", name: "Drink 1L water", order: 1 },
  { id: "freshen-before-9", name: "Freshen up before 9:00 AM", order: 2 },
  { id: "work-until-12", name: "Work mode until 12:00 PM", order: 3 },
  { id: "lunch-target", name: "Lunch within calorie target", order: 4 },
  { id: "ten-thousand-steps", name: "10,000 steps", order: 5 },
  { id: "workout", name: "Workout", order: 6 },
  { id: "study-30", name: "Study for 30 minutes", order: 7 },
  { id: "no-spending", name: "No unnecessary spending", order: 8 },
  { id: "sleep-on-time", name: "Sleep before target time", order: 9 },
];
