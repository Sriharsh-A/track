import { activitySuggestionsSchema } from "../schema";
import type { SuggestionInput, SuggestionProvider } from "../types";
import { SuggestionProviderError } from "../types";

const DEFAULT_MODEL = "gpt-5.6-luna";

function safeModel(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/[\r\n]/g, "").slice(0, 100);
}

function safeCategory(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_:-]{1,80}$/.test(value) ? value : "unavailable";
}

export function createOpenAIProvider(): SuggestionProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = safeModel(process.env.OPENAI_MODEL, DEFAULT_MODEL);

  return {
    name: "openai",
    model,
    isConfigured: Boolean(apiKey),
    async generate(input) {
      if (!apiKey) throw new SuggestionProviderError(503, "missing_api_key");

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({
            model,
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
                schema: activitySuggestionsSchema,
              },
            },
          }),
        });
      } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        const causeCode = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
          ? cause.code
          : error instanceof Error ? error.name : "unavailable";
        throw new SuggestionProviderError(502, safeCategory(causeCode));
      }

      if (!response.ok) {
        let category = "unavailable";
        try {
          const payload = await response.json() as { error?: { code?: unknown; type?: unknown } };
          category = safeCategory(payload.error?.code ?? payload.error?.type);
        } catch {
          // Do not expose provider error bodies to the client or logs.
        }
        throw new SuggestionProviderError(response.status, category);
      }

      let payload: {
        output_text?: unknown;
        output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      };
      try {
        payload = await response.json() as typeof payload;
      } catch {
        throw new SuggestionProviderError(502, "invalid_provider_response");
      }
      const text = typeof payload.output_text === "string"
        ? payload.output_text
        : payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
      if (!text) throw new SuggestionProviderError(502, "empty_provider_response");
      return text;
    },
  };
}
