export interface SuggestionInput {
  goal: string;
  duration: 7 | 30 | 90;
  activities: string[];
}

export interface ActivitySuggestion {
  name: string;
  description: string;
}

export interface SuggestionProvider {
  name: "gemini" | "openai";
  model: string;
  isConfigured: boolean;
  generate(input: SuggestionInput): Promise<string>;
}

export class SuggestionProviderError extends Error {
  constructor(
    readonly status: number,
    readonly category: string,
  ) {
    super("Suggestion provider request failed.");
    this.name = "SuggestionProviderError";
  }
}
