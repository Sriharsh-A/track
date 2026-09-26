import { createGeminiProvider } from "./providers/gemini";
import { createOpenAIProvider } from "./providers/openai";
import { SuggestionProviderError } from "./types";

export function getSuggestionProvider() {
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || "gemini";
  if (configuredProvider === "gemini") return createGeminiProvider();
  if (configuredProvider === "openai") return createOpenAIProvider();
  throw new SuggestionProviderError(500, "unsupported_provider");
}
