import { NextResponse } from "next/server";
import type { PlanDuration } from "@/types/plan";
import { getSuggestionProvider } from "@/lib/ai/provider";
import { SuggestionProviderError, type ActivitySuggestion, type SuggestionInput } from "@/lib/ai/types";

export const runtime = "nodejs";

function errorResponse(status: number) {
  return NextResponse.json({ error: "COULD NOT GENERATE SUGGESTIONS" }, { status });
}

function normalizeActivity(name: string) {
  return name.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

function parseInput(value: unknown): SuggestionInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.goal !== "string" || input.goal.trim().length < 3 || input.goal.trim().length > 240) return null;
  if (input.duration !== 7 && input.duration !== 30 && input.duration !== 90) return null;
  if (!Array.isArray(input.activities) || input.activities.length > 100) return null;
  if (input.activities.some((activity) => typeof activity !== "string" || activity.length > 80)) return null;
  return {
    goal: input.goal.trim(),
    duration: input.duration as PlanDuration,
    activities: input.activities.map((activity) => (activity as string).trim()).filter(Boolean),
  };
}

function parseSuggestions(value: unknown, currentActivities: string[]): ActivitySuggestion[] | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { suggestions?: unknown }).suggestions)) return null;
  const seen = new Set(currentActivities.map(normalizeActivity));
  const result: ActivitySuggestion[] = [];
  for (const item of (value as { suggestions: unknown[] }).suggestions) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.name !== "string" || typeof candidate.description !== "string") continue;
    const name = candidate.name.trim();
    const description = candidate.description.trim();
    const key = normalizeActivity(name);
    if (!name || name.length > 80 || description.length > 140 || !key || seen.has(key)) continue;
    seen.add(key);
    result.push({ name, description });
    if (result.length === 10) break;
  }
  return result.length ? result : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400);
  }

  const input = parseInput(body);
  if (!input) return errorResponse(400);

  let provider;
  try {
    provider = getSuggestionProvider();
  } catch (error) {
    if (error instanceof SuggestionProviderError) {
      console.warn(`[suggestions] provider configuration error; category=${error.category}`);
      return errorResponse(error.status);
    }
    console.warn("[suggestions] provider initialization failed");
    return errorResponse(500);
  }

  console.info(`[suggestions] provider=${provider.name}; model=${provider.model}; api_key_present=${provider.isConfigured ? "yes" : "no"}`);
  if (!provider.isConfigured) {
    console.warn(`[suggestions] provider=${provider.name}; category=missing_api_key`);
    return errorResponse(503);
  }

  try {
    const rawOutput = await provider.generate(input);
    let generated: unknown;
    try {
      generated = JSON.parse(rawOutput);
    } catch {
      console.warn(`[suggestions] provider=${provider.name}; structured_json_parse=failure`);
      return errorResponse(502);
    }

    const suggestions = parseSuggestions(generated, input.activities);
    console.info(`[suggestions] provider=${provider.name}; structured_json_parse=${suggestions ? "success" : "failure"}`);
    if (!suggestions) return errorResponse(502);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof SuggestionProviderError) {
      console.warn(`[suggestions] provider=${provider.name}; upstream_status=${error.status}; category=${error.category}`);
      return errorResponse(error.status >= 400 && error.status <= 599 ? error.status : 502);
    }
    console.warn(`[suggestions] provider=${provider.name}; unexpected_failure`);
    return errorResponse(502);
  }
}
