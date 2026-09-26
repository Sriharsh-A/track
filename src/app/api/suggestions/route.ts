import { NextResponse } from "next/server";
import type { PlanDuration } from "@/types/plan";

export const runtime = "nodejs";

interface SuggestionInput {
  goal: string;
  duration: PlanDuration;
  activities: string[];
}

interface ActivitySuggestion {
  name: string;
  description: string;
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
  },
  required: ["suggestions"],
} as const;

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
    duration: input.duration,
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return errorResponse(503);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_output_tokens: 1200,
        input: [
          {
            role: "system",
            content: "Generate practical, measurable, yes-or-no activities for a personal habit tracker. Return 4 to 8 concise suggestions that directly support the goal and fit the plan duration. Prefer specific actions with clear completion criteria. Do not repeat or rephrase existing activities. Keep descriptions brief and optional. Return only the requested structured JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({ goal: input.goal, durationDays: input.duration, existingActivities: input.activities }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "track_activity_suggestions",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    });

    if (!response.ok) return errorResponse(response.status === 429 ? 429 : 502);
    const payload = await response.json() as {
      output_text?: unknown;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = typeof payload.output_text === "string"
      ? payload.output_text
      : payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) return errorResponse(502);

    let generated: unknown;
    try {
      generated = JSON.parse(outputText);
    } catch {
      return errorResponse(502);
    }
    const suggestions = parseSuggestions(generated, input.activities);
    if (!suggestions) return errorResponse(502);
    return NextResponse.json({ suggestions });
  } catch {
    return errorResponse(502);
  }
}
