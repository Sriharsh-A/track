"use client";

import { useState, type FormEvent } from "react";
import { addCalendarDays, formatCompactDate } from "@/lib/plan-storage";
import type { Activity, Plan, UpdatePlanInput } from "@/types/plan";

interface EditPlanDialogProps {
  plan: Plan;
  onClose: () => void;
  onSave: (input: UpdatePlanInput) => Promise<void>;
}

export function EditPlanDialog({ plan, onClose, onSave }: EditPlanDialogProps) {
  const [name, setName] = useState(plan.name);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [activities, setActivities] = useState<Activity[]>(plan.activities.map((activity) => ({ ...activity })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reorder(index: number, direction: -1 | 1) {
    setActivities((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((activity, order) => ({ ...activity, order }));
    });
  }

  function addActivity() {
    setActivities((current) => [...current, { id: `new-activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", order: current.length }]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const cleanActivities = activities.filter((activity) => activity.name.trim()).map((activity, order) => ({ ...activity, name: activity.name.trim(), order }));
    if (!name.trim() || !startDate || !cleanActivities.length) {
      setError("ADD A PLAN NAME AND AT LEAST ONE ACTIVITY.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), startDate, activities: cleanActivities });
    } catch {
      setError("PLAN COULD NOT BE UPDATED. PLEASE TRY AGAIN.");
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) onClose(); }}>
      <section aria-labelledby="edit-plan-title" aria-modal="true" className="create-plan-dialog" role="dialog">
        <div className="dialog-heading">
          <div><p className="dialog-kicker"><span className="kicker-square" /> PLAN MANAGEMENT / {plan.duration} DAYS</p><h2 id="edit-plan-title">Edit plan</h2></div>
          <button aria-label="Close plan editor" className="dialog-close" disabled={saving} onClick={onClose} type="button">×</button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field plan-name-field"><span>PLAN NAME</span><input autoFocus maxLength={64} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <div className="edit-plan-meta">
            <label className="form-field start-date-field"><span>START DATE</span><input onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} /><small>ENDS {formatCompactDate(addCalendarDays(startDate, plan.duration - 1))}</small></label>
            <div className="form-field"><span>DURATION</span><div className="duration-readonly">{plan.duration} DAYS <small>FIXED FOR THIS PLAN</small></div></div>
          </div>
          <div className="activity-editor-heading"><span>ACTIVITIES <span className="activity-total">/ {activities.length}</span></span><button className="add-activity-button" onClick={addActivity} type="button">+ ADD ACTIVITY</button></div>
          <div aria-label="Edit plan activities" className="activity-editor-list">
            {activities.map((activity, index) => (
              <div className="activity-editor-row" key={activity.id}>
                <span aria-hidden="true" className="activity-index">{String(index + 1).padStart(2, "0")}</span>
                <input aria-label={`Activity ${index + 1}`} maxLength={80} onChange={(event) => setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, name: event.target.value } : item))} placeholder="Activity name" value={activity.name} />
                <span className="activity-order-controls"><button aria-label={`Move activity ${index + 1} up`} disabled={index === 0} onClick={() => reorder(index, -1)} type="button">↑</button><button aria-label={`Move activity ${index + 1} down`} disabled={index === activities.length - 1} onClick={() => reorder(index, 1)} type="button">↓</button></span>
                <button aria-label={`Remove ${activity.name || `activity ${index + 1}`}`} className="remove-activity-button" onClick={() => setActivities((current) => current.filter((item) => item.id !== activity.id).map((item, order) => ({ ...item, order })))} type="button">×</button>
              </div>
            ))}
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="dialog-actions"><span className="dialog-footnote">DURATION REMAINS {plan.duration} DAYS</span><button className="create-plan-button" disabled={saving} type="submit">{saving ? "SAVING..." : "SAVE CHANGES"} <span aria-hidden="true">↗</span></button></div>
        </form>
      </section>
    </div>
  );
}
