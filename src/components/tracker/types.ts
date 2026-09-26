export type CellState = "empty" | "complete" | "incomplete";

export type TrackerState = Record<string, CellState>;

export interface SelectedCell {
  activityIndex: number;
  dayIndex: number;
}
