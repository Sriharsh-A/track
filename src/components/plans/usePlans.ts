"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreatePlanInput, EntryStatus, Plan, UpdatePlanInput } from "@/types/plan";
import { readPlans } from "@/lib/plan-storage";
import { createClient } from "@/lib/supabase/client";
import { createRemotePlan, deleteRemotePlan, importLocalPlans, loadPlans, persistEntry, setRemotePlanArchived, updateRemotePlan } from "@/lib/supabase/plans";

function safeMessage() {
  return "TRACK COULD NOT SAVE YOUR CHANGES. CHECK YOUR CONNECTION AND TRY AGAIN.";
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [migrationPlans, setMigrationPlans] = useState<Plan[]>([]);
  const [migrating, setMigrating] = useState(false);
  const userId = useRef<string | null>(null);
  const plansRef = useRef<Plan[]>([]);
  const entryWrites = useRef(new Map<string, Promise<void>>());
  plansRef.current = plans;

  const reload = useCallback(async () => {
    setError("");
    const client = createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error("Your session could not be verified. Please log in again.");
    userId.current = user.id;
    const remotePlans = await loadPlans(client);
    setPlans(remotePlans);
    const migrationKey = `track:migration:${user.id}`;
    if (!window.localStorage.getItem(migrationKey)) {
      const localPlans = readPlans();
      if (localPlans.length) setMigrationPlans(localPlans);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void reload().catch(() => { if (active) setError("TRACK COULD NOT LOAD YOUR PLANS. PLEASE RETRY."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [reload]);

  const addPlan = useCallback(async (input: CreatePlanInput) => {
    if (!userId.current) throw new Error("Your session has expired. Please log in again.");
    setError("");
    try {
      const plan = await createRemotePlan(createClient(), userId.current, input);
      setPlans((current) => [plan, ...current]);
      return plan;
    } catch {
      setError(safeMessage());
      throw new Error(safeMessage());
    }
  }, []);

  const editPlan = useCallback(async (id: string, input: UpdatePlanInput) => {
    const plan = plansRef.current.find((item) => item.id === id);
    if (!plan) throw new Error("PLAN IS NO LONGER AVAILABLE.");
    setError("");
    try {
      await updateRemotePlan(createClient(), plan, input);
      await reload();
    } catch {
      setError("PLAN COULD NOT BE UPDATED. PLEASE TRY AGAIN.");
      throw new Error("PLAN COULD NOT BE UPDATED. PLEASE TRY AGAIN.");
    }
  }, [reload]);

  const archivePlan = useCallback(async (id: string, archived: boolean) => {
    const previous = plansRef.current.find((plan) => plan.id === id);
    if (!previous) return;
    setError("");
    setPlans((current) => current.map((plan) => plan.id === id ? { ...plan, archived } : plan));
    try {
      await setRemotePlanArchived(createClient(), id, archived);
    } catch {
      setPlans((current) => current.map((plan) => plan.id === id ? previous : plan));
      setError("PLAN STATUS COULD NOT BE UPDATED. PLEASE TRY AGAIN.");
    }
  }, []);

  const removePlan = useCallback(async (id: string) => {
    setError("");
    try {
      await deleteRemotePlan(createClient(), id);
      setPlans((current) => current.filter((plan) => plan.id !== id));
    } catch {
      setError("PLAN COULD NOT BE DELETED. PLEASE TRY AGAIN.");
      throw new Error("PLAN COULD NOT BE DELETED. PLEASE TRY AGAIN.");
    }
  }, []);

  const updatePlan = useCallback(async (id: string, update: (plan: Plan) => Plan) => {
    const previous = plansRef.current.find((plan) => plan.id === id);
    if (!previous) return;
    const next = update(previous);
    setError("");
    setPlans((current) => current.map((plan) => plan.id === id ? next : plan));
    const keys = new Set([...previous.entries, ...next.entries].map((entry) => `${entry.activityId}:${entry.day}`));
    const changed = [...keys].flatMap((key) => {
      const [activityId, dayText] = key.split(":");
      const day = Number(dayText);
      const before = previous.entries.find((entry) => entry.activityId === activityId && entry.day === day)?.status ?? "empty";
      const after = next.entries.find((entry) => entry.activityId === activityId && entry.day === day)?.status ?? "empty";
      return before === after ? [] : [{ activityId, day, before: before as EntryStatus, status: after as EntryStatus }];
    });
    if (!changed.length) return;
    try {
      await Promise.all(changed.map((entry) => {
        const key = `${id}:${entry.activityId}:${entry.day}`;
        const prior = entryWrites.current.get(key) ?? Promise.resolve();
        const write = prior.catch(() => undefined).then(() => persistEntry(createClient(), id, entry.activityId, entry.day, entry.status));
        entryWrites.current.set(key, write);
        return write.finally(() => { if (entryWrites.current.get(key) === write) entryWrites.current.delete(key); });
      }));
    } catch {
      setPlans((current) => current.map((plan) => {
        if (plan.id !== id) return plan;
        let entries = plan.entries;
        for (const entry of changed) {
          const currentStatus = entries.find((item) => item.activityId === entry.activityId && item.day === entry.day)?.status ?? "empty";
          if (currentStatus !== entry.status) continue;
          entries = entries.filter((item) => item.activityId !== entry.activityId || item.day !== entry.day);
          if (entry.before !== "empty") entries = [...entries, { activityId: entry.activityId, day: entry.day, status: entry.before }];
        }
        return { ...plan, entries };
      }));
      setError("ENTRY NOT SAVED. YOUR PREVIOUS STATE HAS BEEN RESTORED.");
    }
  }, []);

  const dismissMigration = useCallback(() => {
    if (userId.current) window.localStorage.setItem(`track:migration:${userId.current}`, "dismissed");
    setMigrationPlans([]);
  }, []);

  const importMigration = useCallback(async () => {
    if (!userId.current || migrating) return;
    setMigrating(true);
    setError("");
    try {
      await importLocalPlans(createClient(), userId.current, migrationPlans);
      window.localStorage.setItem(`track:migration:${userId.current}`, "imported");
      setMigrationPlans([]);
      await reload();
    } catch {
      setError("LOCAL PLANS COULD NOT BE IMPORTED. NO LOCAL DATA WAS REMOVED.");
    } finally {
      setMigrating(false);
    }
  }, [migrationPlans, migrating, reload]);

  return { plans, ready, error, addPlan, editPlan, archivePlan, removePlan, updatePlan, migrationPlans, migrating, importMigration, dismissMigration, reload };
}
