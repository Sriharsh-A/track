import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatePlanInput, EntryStatus, Plan, PlanDuration, UpdatePlanInput } from "@/types/plan";

type PlanRow = {
  id: string; name: string; duration: PlanDuration; user_id: string; start_date: string; archived: boolean; created_at: string;
  activities: { id: string; name: string; position: number }[];
  daily_entries: { activity_id: string; day: number; status: EntryStatus }[];
};

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration,
    createdAt: row.created_at,
    startDate: row.start_date,
    archived: row.archived,
    activities: [...(row.activities ?? [])].sort((a, b) => a.position - b.position).map((activity) => ({ id: activity.id, name: activity.name, order: activity.position })),
    entries: (row.daily_entries ?? []).map((entry) => ({ activityId: entry.activity_id, day: entry.day, status: entry.status })),
  };
}

export async function loadPlans(client: SupabaseClient) {
  const { data, error } = await client.from("plans").select("id,name,duration,user_id,start_date,archived,created_at,activities(id,name,position),daily_entries(activity_id,day,status)").order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PlanRow[]).map(mapPlan);
}

export async function createRemotePlan(client: SupabaseClient, userId: string, input: CreatePlanInput) {
  const { data: planRow, error: planError } = await client.from("plans").insert({
    user_id: userId,
    name: input.name.trim(),
    duration: input.duration,
    start_date: input.startDate,
  }).select("id,name,duration,user_id,start_date,archived,created_at").single();
  if (planError) throw planError;

  const activityRows = input.activities.map((activity, position) => ({ plan_id: planRow.id, name: activity.name.trim(), position }));
  const { error: activityError } = await client.from("activities").insert(activityRows);
  if (activityError) {
    await client.from("plans").delete().eq("id", planRow.id);
    throw activityError;
  }
  const { data, error } = await client.from("plans").select("id,name,duration,user_id,start_date,archived,created_at,activities(id,name,position),daily_entries(activity_id,day,status)").eq("id", planRow.id).single();
  if (error) {
    await client.from("plans").delete().eq("id", planRow.id);
    throw error;
  }
  return mapPlan(data as unknown as PlanRow);
}

export async function updateRemotePlan(client: SupabaseClient, current: Plan, input: UpdatePlanInput) {
  const { error: planError } = await client.from("plans").update({ name: input.name.trim(), start_date: input.startDate }).eq("id", current.id);
  if (planError) throw planError;

  const existingIds = new Set(current.activities.map((activity) => activity.id));
  const retained = input.activities.filter((activity) => existingIds.has(activity.id));
  for (const [index, activity] of current.activities.entries()) {
    const { error } = await client.from("activities").update({ position: 1000000 + index }).eq("id", activity.id).eq("plan_id", current.id);
    if (error) throw error;
  }

  const retainedIds = new Set(retained.map((activity) => activity.id));
  const removedIds = current.activities.filter((activity) => !retainedIds.has(activity.id)).map((activity) => activity.id);
  if (removedIds.length) {
    const { error } = await client.from("activities").delete().eq("plan_id", current.id).in("id", removedIds);
    if (error) throw error;
  }

  for (const [position, activity] of input.activities.entries()) {
    if (!existingIds.has(activity.id)) continue;
    const { error } = await client.from("activities").update({ name: activity.name.trim(), position }).eq("id", activity.id).eq("plan_id", current.id);
    if (error) throw error;
  }
  const added = input.activities.filter((activity) => !existingIds.has(activity.id));
  if (added.length) {
    const { error } = await client.from("activities").insert(added.map((activity) => ({ plan_id: current.id, name: activity.name.trim(), position: input.activities.findIndex((item) => item.id === activity.id) })));
    if (error) throw error;
  }
}

export async function setRemotePlanArchived(client: SupabaseClient, planId: string, archived: boolean) {
  const { error } = await client.from("plans").update({ archived }).eq("id", planId);
  if (error) throw error;
}

export async function deleteRemotePlan(client: SupabaseClient, planId: string) {
  const { error } = await client.from("plans").delete().eq("id", planId);
  if (error) throw error;
}

export async function persistEntry(client: SupabaseClient, planId: string, activityId: string, day: number, status: EntryStatus) {
  const { error } = await client.from("daily_entries").upsert({ plan_id: planId, activity_id: activityId, day, status }, { onConflict: "activity_id,day" });
  if (error) throw error;
}

export async function importLocalPlans(client: SupabaseClient, userId: string, localPlans: Plan[]) {
  const createdPlanIds: string[] = [];
  try {
    for (const plan of localPlans) {
      const { data: planRow, error: planError } = await client.from("plans").insert({
        user_id: userId,
        name: plan.name,
        duration: plan.duration,
        start_date: /^\d{4}-\d{2}-\d{2}$/.test(plan.startDate) ? plan.startDate : plan.createdAt.slice(0, 10),
      }).select("id").single();
      if (planError) throw planError;
      createdPlanIds.push(planRow.id);

      const activityIds = new Map<string, string>();
      for (const [position, activity] of [...plan.activities].sort((a, b) => a.order - b.order).entries()) {
        const { data: insertedActivity, error: activityError } = await client.from("activities").insert({ plan_id: planRow.id, name: activity.name, position }).select("id").single();
        if (activityError) throw activityError;
        activityIds.set(activity.id, insertedActivity.id);
      }
      const entries = plan.entries.filter((entry) => entry.status !== "empty").flatMap((entry) => {
        const activityId = activityIds.get(entry.activityId);
        return activityId ? [{ plan_id: planRow.id, activity_id: activityId, day: entry.day, status: entry.status }] : [];
      });
      if (entries.length) {
        const { error: entryError } = await client.from("daily_entries").insert(entries);
        if (entryError) throw entryError;
      }
    }
  } catch (error) {
    if (createdPlanIds.length) await client.from("plans").delete().in("id", createdPlanIds);
    throw error;
  }
}
