export interface ActivitySuggestion {
  name: string;
  description: string;
}

const suggestionGroups: { matches: RegExp[]; suggestions: ActivitySuggestion[] }[] = [
  {
    matches: [/fit|fitness|workout|exercise|health|weight|run|strength|gym|body/i],
    suggestions: [
      { name: "10,000 steps", description: "Daily movement target" },
      { name: "Workout", description: "Complete a planned training session" },
      { name: "Drink 2L water", description: "Track your daily hydration" },
      { name: "Sleep by 11 PM", description: "Keep a consistent bedtime" },
      { name: "Stretch for 10 minutes", description: "Short mobility session" },
      { name: "Eat within calorie target", description: "Stay within your chosen range" },
      { name: "Take a 10 minute walk", description: "Add a short recovery walk" },
      { name: "Log meals", description: "Record what you eat today" },
    ],
  },
  {
    matches: [/study|learn|exam|school|course|read|skill|practice|language/i],
    suggestions: [
      { name: "Study for 45 minutes", description: "One focused study block" },
      { name: "Review notes", description: "Revisit today's key material" },
      { name: "Practice questions", description: "Test recall with active practice" },
      { name: "Read for 20 minutes", description: "Make steady progress on a topic" },
      { name: "No phone during study", description: "Keep the study block distraction-free" },
      { name: "Summarize one concept", description: "Write a short explanation from memory" },
      { name: "Plan tomorrow's study session", description: "Choose the next task before stopping" },
    ],
  },
  {
    matches: [/morning|routine|consistent|consistency|habit|reset|lock.?in|day/i],
    suggestions: [
      { name: "Wake up by 7:00 AM", description: "Set a consistent start time" },
      { name: "Drink water", description: "Start the day with hydration" },
      { name: "Make the bed", description: "Complete one simple first task" },
      { name: "Take a 10 minute walk", description: "Get outside and move" },
      { name: "No phone for 30 minutes", description: "Protect the first part of the morning" },
      { name: "Review today's plan", description: "Set a clear direction for the day" },
      { name: "Prepare for tomorrow", description: "Set out what you need in advance" },
    ],
  },
  {
    matches: [/work|productiv|focus|career|project|business|deep work/i],
    suggestions: [
      { name: "Plan the top 3 priorities", description: "Identify the day's essential work" },
      { name: "Complete one 60 minute focus block", description: "Work without switching tasks" },
      { name: "Finish the top priority", description: "Close one important open task" },
      { name: "Take a screen-free break", description: "Step away between focus blocks" },
      { name: "Clear the work surface", description: "Reset your desk at the end of the day" },
      { name: "Prepare tomorrow's first task", description: "Make the next start easier" },
    ],
  },
  {
    matches: [/sleep|rest|recover|bedtime/i],
    suggestions: [
      { name: "Be in bed by 10:30 PM", description: "Keep a regular bedtime" },
      { name: "Stop screens 30 minutes before bed", description: "Create a screen-free wind-down" },
      { name: "Wake up at a consistent time", description: "Keep your sleep schedule steady" },
      { name: "Read for 15 minutes", description: "Replace late scrolling with a quiet activity" },
      { name: "Prepare for tomorrow", description: "Clear small tasks before winding down" },
    ],
  },
  {
    matches: [/money|finance|spend|saving|budget/i],
    suggestions: [
      { name: "Log today's spending", description: "Record every purchase" },
      { name: "No unnecessary spending", description: "Pause before non-essential purchases" },
      { name: "Check today's budget", description: "Compare spending with your target" },
      { name: "Review account balance", description: "Take a quick daily snapshot" },
      { name: "Move money to savings", description: "Make a planned contribution" },
    ],
  },
];

const generalSuggestions: ActivitySuggestion[] = [
  { name: "Review today's plan", description: "Choose the important tasks for today" },
  { name: "Move for 30 minutes", description: "Add a deliberate movement session" },
  { name: "Drink 2L water", description: "Track your daily hydration" },
  { name: "Read for 20 minutes", description: "Make steady progress on a topic" },
  { name: "Complete one focused work block", description: "Protect time for one priority" },
  { name: "Prepare for tomorrow", description: "Make the next day easier to start" },
  { name: "Sleep before 11 PM", description: "Keep a consistent rest routine" },
];

export function normalizeActivityName(name: string) {
  return name.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

export function getLocalActivitySuggestions(goal: string, currentActivities: string[] = []): ActivitySuggestion[] {
  const cleanGoal = goal.trim();
  if (!cleanGoal) return [];

  const matches = suggestionGroups
    .filter((group) => group.matches.some((pattern) => pattern.test(cleanGoal)))
    .flatMap((group) => group.suggestions);
  const candidates = matches.length ? matches : generalSuggestions;
  const existing = new Set(currentActivities.map(normalizeActivityName).filter(Boolean));
  const seen = new Set<string>();

  return candidates.filter((suggestion) => {
    const key = normalizeActivityName(suggestion.name);
    if (!key || existing.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
