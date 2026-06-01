# IniClaw (AI Gateway)

## Features

- **AI Tutor:** An interactive chat interface for students to get help (`ai-tutor.tsx`).
- **LLM Integrations:** Connects to external AI models (like OpenAI and potentially Gemini, as seen in the test warnings).
- **Evaluation & Test Generation:** Generates questions, evaluates subjective answers, and analyzes test performance using AI.

## Test Status

- `openai_unit.test.ts` and `ai_tutor.test.ts` are passing.
- The tests correctly implement fallback mechanisms (returning default objects or local calculations) when the AI service throws errors (e.g., rate limits or invalid JSON), ensuring the application doesn't completely crash if the LLM provider goes down.

## Simplification Recommendations

- **Remove "Gateway" Overhead:** If IniClaw is intended to be a "lightweight LLM gateway", ensure it isn't just wrapping an SDK (like the OpenAI SDK) with unnecessary custom types and interfaces. If the app only ever talks to OpenAI, just use the SDK directly in the services that need it.
- **JSON Parsing:** The tests reveal that the AI occasionally returns invalid JSON. Ensure the application is using "Structured Outputs" (if using recent OpenAI models) or robust schema validation (like Zod, which appears to be in use) to drastically simplify the error handling logic required for parsing LLM text.
