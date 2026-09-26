import type { Activity } from "@/types/plan";
import type { CellState, SelectedCell } from "./types";

interface TrackerCellProps {
  activity: Activity;
  day: number;
  future: boolean;
  state: CellState;
  selected: boolean;
  activityIndex: number;
  dayIndex: number;
  onSelect: (selected: SelectedCell) => void;
  onCycle: (activityId: string, day: number) => void;
}

export function TrackerCell({ activity, day, future, state, selected, activityIndex, dayIndex, onSelect, onCycle }: TrackerCellProps) {
  const symbol = state === "complete" ? "✓" : state === "incomplete" ? "×" : "";
  const status = state === "complete" ? "complete" : state === "incomplete" ? "incomplete" : "empty";

  return (
    <td className={future ? "day-future" : undefined}>
      <button
        aria-label={`${activity.name}, day ${day}: ${status}`}
        aria-pressed={state === "complete"}
        className={`tracker-button${state === "complete" ? " is-complete" : state === "incomplete" ? " is-incomplete" : ""}${selected ? " is-selected" : ""}`}
        data-cell="true"
        data-state={state}
        onClick={() => { onSelect({ activityIndex, dayIndex }); onCycle(activity.id, day); }}
        onFocus={() => onSelect({ activityIndex, dayIndex })}
        tabIndex={selected ? 0 : -1}
        type="button"
      >
        {symbol}
      </button>
    </td>
  );
}
