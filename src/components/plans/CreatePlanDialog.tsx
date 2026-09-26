"use client";

import { useEffect, useState, type FormEvent } from "react";
import { planTemplates } from "@/data/templates";
import { addCalendarDays, formatCompactDate, localDateString } from "@/lib/plan-storage";
import type { Activity, CreatePlanInput, PlanDuration } from "@/types/plan";

interface CreatePlanDialogProps {
  onClose: () => void;
  onCreate: (input: CreatePlanInput) => void | Promise<void>;
}

interface ActivitySuggestion {
  name: string;
  description: string;
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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

  async function generateSuggestions() {
    const cleanGoal = goal.trim();
    if (!cleanGoal || isGenerating) return;

    setIsGenerating(true);
    setSuggestionError("");
    setSuggestionNotice("");
    setSuggestions([]);
    setSelectedSuggestions([]);
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
      if (!response.ok || !Array.isArray(payload.suggestions)) {
        throw new Error(payload.error || "COULD NOT GENERATE SUGGESTIONS");
      }
      setSuggestions(payload.suggestions);
    } catch {
      setSuggestionError("COULD NOT GENERATE SUGGESTIONS");
    } finally {
      setIsGenerating(false);
    }
  }

  function addSelectedSuggestions() {
    const existing = new Set(activities.map((activity) => normalizeActivity(activity.name)).filter(Boolean));
    const selected = suggestions.filter((suggestion) => selectedSuggestions.includes(suggestion.name));
    const unique = selected.filter((suggestion) => {
      const normalized = normalizeActivity(suggestion.name);
      if (!normalized || existing.has(normalized)) return false;
      existing.add(normalized);
      return true;
    });
    if (unique.length) {
      setActivities((current) => [
        ...current,
        ...unique.map((suggestion, index) => ({ id: draftActivityId(), name: suggestion.name, order: current.length + index })),
      ]);
      setSelectedTemplate(null);
    }
    setSelectedSuggestions([]);
    setSuggestionNotice(unique.length ? `${unique.length} ACTIVITIES ADDED TO PLAN` : "SELECT AT LEAST ONE NEW ACTIVITY");
  }

  function toggleSuggestion(name: string) {
    setSelectedSuggestions((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const cleanActivities = activities.filter((activity) => activity.name.trim()).map((activity, order) => ({ ...activity, name: activity.name.trim(), order }));
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
              <span>AI SUGGEST ACTIVITIES</span>
              <span className="ai-suggestions-duration">{duration} DAYS</span>
              <span className="ai-suggestions-chevron" aria-hidden="true">{suggestionsOpen ? "−" : "+"}</span>
            </button>
            {suggestionsOpen && (
              <div className="ai-suggestions-content">
                <div className="ai-suggestions-form">
                  <label className="form-field ai-goal-field">
                    <span>WHAT ARE YOU TRYING TO ACHIEVE?</span>
                    <input maxLength={240} onChange={(event) => { setGoal(event.target.value); setSuggestionError(""); }} placeholder="e.g. Build a consistent morning routine" value={goal} />
                  </label>
                  <button className="ai-generate-button" disabled={!goal.trim() || isGenerating} onClick={() => void generateSuggestions()} type="button">
                    {isGenerating ? "GENERATING..." : suggestions.length ? "REGENERATE" : "GENERATE SUGGESTIONS"}
                    {!isGenerating && <span aria-hidden="true">↗</span>}
                  </button>
                </div>
                {suggestionError && <p className="ai-suggestion-error" role="alert"><span>!</span> {suggestionError}<span className="ai-error-retry"> Try again.</span></p>}
                {suggestionNotice && <p aria-live="polite" className="ai-suggestion-notice">{suggestionNotice}</p>}
                {suggestions.length > 0 && (
                  <div className="ai-suggestion-results">
                    <div className="ai-results-heading"><span>SUGGESTED ACTIVITIES</span><span>{suggestions.length} OPTIONS</span></div>
                    {suggestions.map((suggestion) => (
                      <label className="ai-suggestion-option" key={suggestion.name}>
                        <input checked={selectedSuggestions.includes(suggestion.name)} onChange={() => toggleSuggestion(suggestion.name)} type="checkbox" />
                        <span className="ai-suggestion-check" aria-hidden="true">✓</span>
                        <span className="ai-suggestion-copy"><strong>{suggestion.name}</strong>{suggestion.description && <small>{suggestion.description}</small>}</span>
                      </label>
                    ))}
                    <button className="ai-add-selected" onClick={addSelectedSuggestions} type="button">ADD SELECTED <span aria-hidden="true">↗</span></button>
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="activity-editor-heading">
            <span>ACTIVITIES <span className="activity-total">/ {activities.filter((activity) => activity.name.trim()).length}</span></span>
            <button className="add-activity-button" onClick={() => setActivities((current) => [...current, { id: draftActivityId(), name: "", order: current.length }])} type="button">+ ADD ACTIVITY</button>
          </div>
          <div aria-label="Plan activities" className="activity-editor-list">
            {activities.map((activity, index) => (
              <div className="activity-editor-row" key={activity.id}>
                <span aria-hidden="true" className="activity-index">{String(index + 1).padStart(2, "0")}</span>
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

function normalizeActivity(name: string) {
  return name.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").trim();
}
