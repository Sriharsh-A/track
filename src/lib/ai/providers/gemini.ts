import type { SuggestionInput, SuggestionProvider } from "../types";
import { SuggestionProviderError } from "../types";

const DEFAULT_MODEL = "gemini-3.8-flash";

// Gemini's REST Schema message does not accept the OpenAI-specific
// additionalProperties constraint used by the shared provider schema.
const geminiActivitySuggestionsSchema = {
  type: "OBJECT",
  properties: {
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["name", "description"],
      },
    },
  },
  required: ["suggestions"],
} as const;

function safeModel(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/[\r\n]/g, "").slice(0, 100);
}

function promptFor(input: SuggestionInput) {
  return JSON.stringify({
    goal: input.goal,
    durationDays: input.duration,
    existingActivities: input.activities,
  });
}

function safeCategory(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_:-]{1,80}$/.test(value) ? value : "unavailable";
}

export function createGeminiProvider(): SuggestionProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = safeModel(process.env.GEMINI_MODEL, DEFAULT_MODEL);

  return {
    name: "gemini",
    model,
    isConfigured: Boolean(apiKey),
    async generate(input) {
      if (!apiKey) throw new SuggestionProviderError(503, "missing_api_key");

      let response: Response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "You create practical, measurable yes-or-no activities for a personal habit tracker. Interpret the user's goal, convert it into specific trackable activities, and return 4 to 8 concise suggestions. Each activity must be completable once per day and should directly support the goal. Do not repeat or rephrase existing activities. Keep each description brief.",
              }],
            },
            contents: [{ role: "user", parts: [{ text: promptFor(input) }] }],
            generationConfig: {
              maxOutputTokens: 1200,
              responseMimeType: "application/json",
              responseSchema: geminiActivitySuggestionsSchema,
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
          const payload = await response.json() as { error?: { status?: unknown; code?: unknown } };
          category = safeCategory(payload.error?.status ?? payload.error?.code);
        } catch {
          // Do not expose provider error bodies to the client or logs.
        }
        throw new SuggestionProviderError(response.status, category);
      }

      let payload: {
        candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
      };
      try {
        payload = await response.json() as typeof payload;
      } catch {
        throw new SuggestionProviderError(502, "invalid_provider_response");
      }

      const text = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text)
        .find((part): part is string => typeof part === "string");
      if (!text) throw new SuggestionProviderError(502, "empty_provider_response");
      return text;
    },
  };
}
