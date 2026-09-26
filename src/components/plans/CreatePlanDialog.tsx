"use client";

import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  getLocalActivitySuggestions,
  normalizeActivityName,
  type ActivitySuggestion,
} from "@/data/activity-suggestions";
import { planTemplates } from "@/data/templates";
import { addCalendarDays, formatCompactDate, localDateString } from "@/lib/plan-storage";
import type { Activity, CreatePlanInput, PlanDuration } from "@/types/plan";

interface CreatePlanDialogProps {
  onClose: () => void;
  onCreate: (input: CreatePlanInput) => void | Promise<void>;
}

const durations: PlanDuration[] = [7, 30, 90];

function draftActivityId() {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CreatePlanDialog({ onClose, onCreate }: CreatePlanDialogProps) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<PlanDuration>(30);
  const [startDate, setStartDate] = useState(() => localDateString());
  const [activities, setActivities] = useState<Activity[]>([{ id: "draft-activity-1", name: "", order: 0 }]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [goal, setGoal] = useState("");
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [suggestionSource, setSuggestionSource] = useState<"local" | "gemini">("local");
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const localSuggestions = useMemo(
    () => getLocalActivitySuggestions(goal, activities.map((activity) => activity.name)),
    [activities, goal],
  );
  const visibleSuggestions = suggestions.length ? suggestions : localSuggestions;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function chooseTemplate(templateId: string) {
    const template = planTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplate(template.id);
    setName(template.name.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
    setDuration(template.duration);
    setActivities(template.activities.map((activityName, order) => ({ id: `${template.id}-${order + 1}`, name: activityName, order })));
  }

  function updateActivity(activityId: string, value: string) {
    setActivities((current) => current.map((activity) => activity.id === activityId ? { ...activity, name: value } : activity));
  }

  function removeActivity(activityId: string) {
    setActivities((current) => current.filter((activity) => activity.id !== activityId).map((activity, order) => ({ ...activity, order })));
  }

  function moveActivity(index: number, direction: -1 | 1) {
    setActivities((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered.map((activity, order) => ({ ...activity, order }));
    });
  }

  function reorderActivity(draggedId: string, targetId: string, after: boolean) {
    setActivities((current) => {
      const from = current.findIndex((activity) => activity.id === draggedId);
      const target = current.findIndex((activity) => activity.id === targetId);
      if (from < 0 || target < 0 || from === target) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      const adjustedTarget = from < target ? target - 1 : target;
      next.splice(adjustedTarget + (after ? 1 : 0), 0, moved);
      return next.map((activity, order) => ({ ...activity, order }));
    });
  }

  function handleActivityDragOver(event: DragEvent<HTMLDivElement>, activityId: string) {
    if (!draggedActivityId || draggedActivityId === activityId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDropTarget({ id: activityId, after: event.clientY > rect.top + rect.height / 2 });
  }

  function addSuggestion(suggestion: ActivitySuggestion) {
    const normalized = normalizeActivityName(suggestion.name);
    if (!normalized || activities.some((activity) => normalizeActivityName(activity.name) === normalized)) return;
    setActivities((current) => [...current, { id: draftActivityId(), name: suggestion.name, order: current.length }]);
    setSelectedTemplate(null);
    setSuggestionNotice("ACTIVITY ADDED TO PLAN");
  }

  async function generateSuggestions() {
    const cleanGoal = goal.trim();
    if (!cleanGoal || isGenerating) return;

    setIsGenerating(true);
    setSuggestionNotice("");
    setSuggestions([]);
    setSuggestionSource("local");
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: cleanGoal,
          duration,
          activities: activities.map((activity) => activity.name.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json() as { suggestions?: ActivitySuggestion[]; error?: string };
      if (!response.ok || !Array.isArray(payload.suggestions) || payload.suggestions.length === 0) throw new Error("FALLBACK");
      setSuggestions(payload.suggestions.slice(0, 8));
      setSuggestionSource("gemini");
      setSuggestionNotice("GEMINI SUGGESTIONS · SELECT EACH ACTIVITY TO ADD");
    } catch {
      setSuggestions([]);
      setSuggestionSource("local");
      setSuggestionNotice(localSuggestions.length ? "AI UNAVAILABLE · LOCAL SUGGESTIONS SHOWN" : "NO MATCHES YET · TRY A DIFFERENT GOAL");
    } finally {
      setIsGenerating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const seen = new Set<string>();
    const cleanActivities = activities.filter((activity) => {
      const normalized = normalizeActivityName(activity.name);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).map((activity, order) => ({ ...activity, name: activity.name.trim(), order }));
    if (!name.trim() || cleanActivities.length === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      await onCreate({ name: name.trim(), duration, startDate, activities: cleanActivities });
    } catch {
      setSaveError("PLAN COULD NOT BE SAVED. PLEASE TRY AGAIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section aria-labelledby="create-plan-title" aria-modal="true" className="create-plan-dialog" role="dialog">
        <div className="dialog-heading">
          <div>
            <p className="dialog-kicker"><span className="kicker-square" /> NEW TRACKING SYSTEM</p>
            <h2 id="create-plan-title">Build a plan</h2>
          </div>
          <button aria-label="Close plan creator" className="dialog-close" onClick={onClose} type="button">×</button>
        </div>

        <form onSubmit={submit}>
          <fieldset className="template-fieldset">
            <legend>START WITH A TEMPLATE</legend>
            <div className="template-list">
              {planTemplates.map((template) => (
                <button aria-pressed={selectedTemplate === template.id} className={`template-option${selectedTemplate === template.id ? " is-active" : ""}`} key={template.id} onClick={() => chooseTemplate(template.id)} type="button">
                  <span>{template.name}</span><span className="template-duration">{template.duration}D</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="plan-form-row">
            <label className="form-field plan-name-field">
              <span>PLAN NAME</span>
              <input autoFocus maxLength={64} onChange={(event) => { setName(event.target.value); setSelectedTemplate(null); }} placeholder="My 30 Day Lock-In" value={name} />
            </label>
            <fieldset className="duration-fieldset">
              <legend>DURATION</legend>
              <div className="duration-options">
                {durations.map((option) => <button aria-pressed={duration === option} className={`duration-option${duration === option ? " is-active" : ""}`} key={option} onClick={() => setDuration(option)} type="button">{option} DAYS</button>)}
              </div>
            </fieldset>
          </div>

          <label className="form-field start-date-field">
            <span>START DATE</span>
            <input onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
            <small>ENDS {formatCompactDate(addCalendarDays(startDate, duration - 1))}</small>
          </label>

          <section className="ai-suggestions-module">
            <button aria-expanded={suggestionsOpen} className="ai-suggestions-toggle" onClick={() => setSuggestionsOpen((open) => !open)} type="button">
              <span className="ai-suggestions-symbol" aria-hidden="true">✦</span>
              <span>SUGGESTED ACTIVITIES</span>
              <span className="ai-suggestions-duration">{duration} DAYS</span>
              <span className="ai-suggestions-chevron" aria-hidden="true">{suggestionsOpen ? "−" : "+"}</span>
            </button>
            {suggestionsOpen && (
              <div className="ai-suggestions-content">
                <div className="ai-suggestions-form">
                  <label className="form-field ai-goal-field">
                    <span>WHAT ARE YOU TRYING TO ACHIEVE?</span>
                    <input maxLength={240} onChange={(event) => { setGoal(event.target.value); setSuggestions([]); setSuggestionSource("local"); setSuggestionNotice(""); }} placeholder="e.g. Build a consistent morning routine" value={goal} />
                  </label>
                  <button className="ai-generate-button" disabled={!goal.trim() || isGenerating} onClick={() => void generateSuggestions()} type="button">
                    {isGenerating ? "ASKING GEMINI..." : suggestions.length ? "REFRESH WITH GEMINI" : "ASK GEMINI"}
                    {!isGenerating && <span aria-hidden="true">↗</span>}
                  </button>
                </div>
                {suggestionNotice && <p aria-live="polite" className="ai-suggestion-notice">{suggestionNotice}</p>}
                {visibleSuggestions.length > 0 && (
                  <div className="ai-suggestion-results">
                    <div className="ai-results-heading"><span>BASED ON YOUR GOAL</span><span>{suggestionSource === "gemini" ? "GEMINI" : "LOCAL MATCHES"} · {visibleSuggestions.length} OPTIONS</span></div>
                    {visibleSuggestions.map((suggestion) => {
                      const alreadyAdded = activities.some((activity) => normalizeActivityName(activity.name) === normalizeActivityName(suggestion.name));
                      return (
                        <div className="ai-suggestion-option" key={suggestion.name}>
                          <span className="ai-suggestion-check" aria-hidden="true">+</span>
                          <span className="ai-suggestion-copy"><strong>{suggestion.name}</strong>{suggestion.description && <small>{suggestion.description}</small>}</span>
                          <button aria-label={`${alreadyAdded ? "Already added" : "Add"} ${suggestion.name}`} className="suggestion-add-button" disabled={alreadyAdded} onClick={() => addSuggestion(suggestion)} type="button">{alreadyAdded ? "ADDED" : "+ ADD"}</button>
                        </div>
                      );
})}
                  </div>
                )}
                {!goal.trim() && <p className="suggestion-empty-hint">Enter a goal to see trackable activity ideas.</p>}
              </div>
            )}
          </section>

          <div className="activity-editor-heading">
            <span>ACTIVITIES <span className="activity-total">/ {activities.filter((activity) => activity.name.trim()).length}</span></span>
            <button className="add-activity-button" onClick={() => setActivities((current) => [...current, { id: draftActivityId(), name: "", order: current.length }])} type="button">+ ADD ACTIVITY</button>
          </div>
          <div aria-label="Plan activities" className="activity-editor-list">
            {activities.map((activity, index) => (
              <div
                className={`activity-editor-row${draggedActivityId === activity.id ? " is-dragging" : ""}${dropTarget?.id === activity.id ? dropTarget.after ? " drop-after" : " drop-before" : ""}`}
                key={activity.id}
                onDragOver={(event) => handleActivityDragOver(event, activity.id)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedActivityId) reorderActivity(draggedActivityId, activity.id, dropTarget?.id === activity.id ? Boolean(dropTarget.after) : false);
                  setDraggedActivityId(null);
                  setDropTarget(null);
                }}
              >
                <span aria-hidden="true" className="activity-index">{String(index + 1).padStart(2, "0")}</span>
                <button
                  aria-label={`Drag to reorder activity ${index + 1}; use the up and down buttons for keyboard reordering`}
                  className="activity-drag-handle"
                  draggable
                  onDragEnd={() => { setDraggedActivityId(null); setDropTarget(null); }}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", activity.id); setDraggedActivityId(activity.id); }}
                  title="Drag to reorder"
                  type="button"
                >≡</button>
                <input aria-label={`Activity ${index + 1}`} maxLength={80} onChange={(event) => updateActivity(activity.id, event.target.value)} placeholder="Activity name" value={activity.name} />
                <span className="activity-order-controls"><button aria-label={`Move activity ${index + 1} up`} disabled={index === 0} onClick={() => moveActivity(index, -1)} type="button">↑</button><button aria-label={`Move activity ${index + 1} down`} disabled={index === activities.length - 1} onClick={() => moveActivity(index, 1)} type="button">↓</button></span>
                <button aria-label={`Remove ${activity.name || `activity ${index + 1}`}`} className="remove-activity-button" onClick={() => removeActivity(activity.id)} type="button">×</button>
              </div>
            ))}
            {activities.length === 0 && <p className="empty-activities">Add at least one activity to create your plan.</p>}
          </div>

          <div className="dialog-actions">
            <span className="dialog-footnote">{duration} DAYS <span aria-hidden="true">/</span> {activities.filter((activity) => activity.name.trim()).length} ACTIVITIES</span>
            {saveError && <span className="inline-error" role="alert">{saveError}</span>}
            <button className="create-plan-button" disabled={saving || !name.trim() || !activities.some((activity) => activity.name.trim())} type="submit">{saving ? "SAVING..." : "CREATE PLAN"} <span aria-hidden="true">↗</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}

