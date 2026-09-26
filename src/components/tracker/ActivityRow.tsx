import type { Activity } from "@/types/plan";
import type { CellState, SelectedCell } from "./types";
import { TrackerCell } from "./TrackerCell";

interface ActivityRowProps {
  activity: Activity;
  activityIndex: number;
  days: number;
  futureDays: Set<number>;
  selected: SelectedCell;
  stateFor: (activityId: string, day: number) => CellState;
  onSelect: (selected: SelectedCell) => void;
  onCycle: (activityId: string, day: number) => void;
}

export function ActivityRow({ activity, activityIndex, days, futureDays, selected, stateFor, onSelect, onCycle }: ActivityRowProps) {
  return (
    <tr>
      <th scope="row" className="activity-cell">
        <span className="activity-content"><span aria-hidden="true" className="activity-index">{String(activityIndex + 1).padStart(2, "0")}</span><span className="activity-name">{activity.name}</span></span>
      </th>
      {Array.from({ length: days }, (_, dayIndex) => {
        const day = dayIndex + 1;
        return <TrackerCell key={`${activity.id}-${day}`} activity={activity} day={day} future={futureDays.has(day)} state={stateFor(activity.id, day)} selected={selected.activityIndex === activityIndex && selected.dayIndex === dayIndex} activityIndex={activityIndex} dayIndex={dayIndex} onSelect={onSelect} onCycle={onCycle} />;
      })}
    </tr>
  );
}
