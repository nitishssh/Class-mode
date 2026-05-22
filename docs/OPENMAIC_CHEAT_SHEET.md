# OpenMAIC Agent Cheat Sheet

> **Repo**: [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) · v0.2.1 · AGPL-3.0 · 17.5k ⭐
> **Stack**: Next.js 16 App Router · React 19 · pnpm · Zustand · TailwindCSS v4 · TypeScript 5 · Node ≥20.9

---

## Build & Run

```bash
pnpm install              # postinstall builds packages/mathml2omml + packages/pptxgenjs
pnpm dev                  # next dev (default port 3000)
pnpm build                # next build
pnpm test                 # vitest run
pnpm test:e2e             # playwright test
pnpm lint                 # eslint
pnpm format               # prettier
pnpm eval:whiteboard      # tsx eval/whiteboard-layout/runner.ts
pnpm eval:outline-language # tsx eval/outline-language/runner.ts
```

---

## Path Alias

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `./*` (project root) |

All imports use `@/lib/...`, `@/components/...`, `@/app/...` etc.

---

## Directory Map

```
OpenMAIC/
├── app/                          # Next.js App Router pages + API routes
│   ├── api/
│   │   ├── chat/route.ts         # POST /api/chat — SSE multi-agent chat
│   │   ├── generate/route.ts     # POST /api/generate — classroom generation
│   │   ├── tts/route.ts          # POST /api/tts — text-to-speech
│   │   ├── asr/route.ts          # POST /api/asr — speech recognition
│   │   ├── pdf/route.ts          # POST /api/pdf — PDF parsing
│   │   ├── image/route.ts        # POST /api/image — image generation
│   │   ├── video/route.ts        # POST /api/video — video generation
│   │   └── search/route.ts       # POST /api/search — web search
│   ├── classroom/[id]/page.tsx   # Classroom playback page
│   ├── page.tsx                  # Home page (topic input + generation)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── lib/                          # Core business logic (THE BRAIN)
│   ├── ai/                       # LLM provider system
│   │   ├── providers.ts          # Provider registry (15+ providers)
│   │   ├── model-metadata.ts     # Model capability metadata
│   │   └── thinking-config.ts    # Thinking/reasoning config
│   │
│   ├── orchestration/            # Multi-agent orchestration (LangGraph)
│   │   ├── director-graph.ts     # StateGraph: START → director → agent → director loop
│   │   ├── director-prompt.ts    # Director decision prompt builder
│   │   ├── prompt-builder.ts     # Agent system prompt builder
│   │   ├── stateless-generate.ts # SSE streaming + JSON Array parser
│   │   ├── ai-sdk-adapter.ts     # Vercel AI SDK ↔ LangGraph bridge
│   │   ├── tool-schemas.ts       # Action allowlist per agent/scene
│   │   ├── registry/             # Agent config registry (Zustand store)
│   │   ├── summarizers/          # Conversation summary + message converter
│   │   └── types.ts              # AgentTurnSummary, WhiteboardActionRecord
│   │
│   ├── generation/               # Two-stage classroom generation
│   │   ├── outline-generator.ts  # Stage 1: requirements → SceneOutline[]
│   │   ├── scene-generator.ts    # Stage 2: outlines → full Scene[]
│   │   ├── scene-builder.ts      # Build Scene objects from generated content
│   │   ├── action-parser.ts      # Parse action sequences from generated text
│   │   ├── json-repair.ts        # JSON repair utilities
│   │   ├── pipeline-types.ts     # AICallFn, GenerationResult, callbacks
│   │   ├── pipeline-runner.ts    # Orchestrates full generation pipeline
│   │   ├── prompt-formatters.ts  # Image/PDF prompt formatting
│   │   └── prompts/              # Prompt templates (Markdown files)
│   │
│   ├── playback/                 # Playback state machine
│   │   ├── engine.ts             # PlaybackEngine class (idle→playing→paused→live)
│   │   ├── derived-state.ts      # Derived playback state selectors
│   │   ├── types.ts              # EngineMode, PlaybackSnapshot, callbacks
│   │   └── index.ts              # Re-exports
│   │
│   ├── action/                   # Action execution engine
│   │   └── engine.ts             # ActionEngine — executes actions on canvas/whiteboard
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── action.ts             # 20+ Action types (speech, spotlight, wb_*, widget_*)
│   │   ├── stage.ts              # Stage, Scene, SceneContent, QuizQuestion
│   │   ├── chat.ts               # StatelessChatRequest, StatelessEvent, DirectorState
│   │   ├── generation.ts         # UserRequirements, SceneOutline, GeneratedContent
│   │   ├── slides.ts             # PPTElement, Slide (PPTist-compatible)
│   │   ├── widgets.ts            # WidgetType, WidgetConfig (5 widget types)
│   │   └── provider.ts           # ProviderId, ProviderConfig, ModelInfo
│   │
│   ├── store/                    # Zustand state stores
│   │   ├── main-store.ts         # Main app state (stage, scenes, mode)
│   │   ├── canvas.ts             # Canvas/whiteboard state
│   │   ├── settings.ts           # User settings (TTS, model, theme)
│   │   └── chat.ts               # Chat session state
│   │
│   ├── pbl/                      # Project-Based Learning module
│   ├── media/                    # Image/video generation
│   ├── prompts/                  # Prompt template system
│   ├── server/                   # Server-only utilities
│   ├── tts/                      # TTS provider abstraction
│   ├── utils/                    # Shared utilities
│   └── constants/                # App constants
│
├── components/                   # React UI components
│   ├── stage/                    # Main classroom stage
│   ├── slide-renderer/           # Canvas-based slide rendering
│   ├── scene-renderers/          # Quiz, Interactive, PBL renderers
│   ├── whiteboard/               # SVG whiteboard component
│   ├── chat/                     # Chat UI panel
│   ├── agent/                    # Agent cards, avatars
│   ├── generation/               # Generation progress UI
│   ├── canvas/                   # Canvas overlay (spotlight, laser)
│   ├── audio/                    # Audio controls, TTS settings
│   ├── roundtable/               # Discussion/debate UI
│   ├── settings/                 # Settings panel
│   ├── ai-elements/              # AI-generated element renderers
│   └── ui/                       # Shared UI primitives (shadcn)
│
├── packages/                     # Internal packages
│   ├── mathml2omml/              # MathML → OMML conversion (PPTX)
│   └── pptxgenjs/                # Modified pptxgenjs for export
│
├── locales/                      # i18n (en, zh-CN, ja, ru)
├── eval/                         # Evaluation benchmarks
├── e2e/                          # Playwright E2E tests
└── openclaw/                     # OpenClaw agent gateway
```

---

## Core Data Flow

```
User types topic
    ↓
POST /api/generate
    ↓
┌─────────────────────────────────────────┐
│  Stage 1: outline-generator.ts          │
│  UserRequirements → SceneOutline[]      │
│  (topic, PDF text, images → outlines)   │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Stage 2: scene-generator.ts            │
│  SceneOutline → Scene (per-scene)       │
│  Generates: canvas, actions, quiz, HTML │
└────────────────┬────────────────────────┘
                 ↓
Client receives Stage + Scene[] → stores in Zustand
    ↓
Classroom Page loads → PlaybackEngine.start()
    ↓
PlaybackEngine processes Scene.actions[] sequentially
    ↓
ActionEngine executes each action on canvas/whiteboard
```

---

## Type System — The 4 Core Types

### 1. Scene Types (`lib/types/stage.ts`)

```typescript
type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl';

interface Scene {
  id: string;
  stageId: string;
  type: SceneType;
  title: string;
  order: number;
  content: SlideContent | QuizContent | InteractiveContent | PBLContent;
  actions?: Action[];         // Playback actions
  whiteboards?: Slide[];      // Whiteboard content
  multiAgent?: { enabled: boolean; agentIds: string[]; directorPrompt?: string; };
}
```

### 2. Action Types (`lib/types/action.ts`) — 20 total

| Category | Types |
|---|---|
| **Fire-and-forget** | `spotlight`, `laser` |
| **Speech** | `speech` (text, audioId, audioUrl, voice, speed) |
| **Whiteboard** | `wb_open`, `wb_close`, `wb_clear`, `wb_delete`, `wb_draw_text`, `wb_draw_shape`, `wb_draw_chart`, `wb_draw_latex`, `wb_draw_table`, `wb_draw_line`, `wb_draw_code`, `wb_edit_code` |
| **Widget** | `widget_highlight`, `widget_setState`, `widget_annotation`, `widget_reveal` |
| **Other** | `play_video`, `discussion` |

### 3. Widget Types (`lib/types/widgets.ts`) — 5 types

```typescript
type WidgetType = 'simulation' | 'diagram' | 'code' | 'game' | 'visualization3d';
// Each has its own config: SimulationConfig, DiagramConfig, CodeConfig, GameConfig, Visualization3DConfig
```

### 4. SSE Event Types (`lib/types/chat.ts`)

```typescript
type StatelessEvent =
  | { type: 'agent_start'; data: { messageId, agentId, agentName, agentAvatar?, agentColor? } }
  | { type: 'agent_end';   data: { messageId, agentId } }
  | { type: 'text_delta';  data: { content, messageId? } }
  | { type: 'action';      data: { actionId, actionName, params, agentId, messageId? } }
  | { type: 'thinking';    data: { stage: 'director' | 'agent_loading', agentId? } }
  | { type: 'cue_user';    data: { fromAgentId?, prompt? } }
  | { type: 'done';        data: { totalActions, totalAgents, agentHadContent?, directorState? } }
  | { type: 'error';       data: { message } };
```

---

## Orchestration — LangGraph Director Graph

```
START → director ──(shouldEnd=true)──→ END
           │
           └─(shouldEnd=false)→ agent_generate ──→ director (loop)
```

### State (`OrchestratorState`)

```typescript
// Immutable inputs (set once)
messages, storeState, availableAgentIds, maxTurns, languageModel,
thinkingConfig, discussionContext, triggerAgentId, userProfile, agentConfigOverrides

// Mutable (updated by nodes)
currentAgentId, turnCount, agentResponses (reducer: append),
whiteboardLedger (reducer: append), shouldEnd, totalActions
```

### Director Strategy

- **Single agent**: Pure code logic (no LLM). Turn 0 → dispatch agent. Turn 1+ → cue user.
- **Multi agent**: Turn 0 + triggerAgentId → fast-path dispatch. Otherwise → LLM decides next agent / USER / END.

### Agent Generate Node

1. Resolves `AgentConfig` from overrides or registry
2. Computes `effectiveActions` filtered by scene type
3. Builds system prompt via `buildStructuredPrompt()`
4. Streams via `AISdkLangGraphAdapter.streamGenerate()`
5. Parses structured JSON Array output via `parseStructuredChunk()`
6. Emits SSE events: `agent_start` → `text_delta`/`action` → `agent_end`

### Structured Output Format

The LLM produces a JSON array where text and actions freely interleave:

```json
[
  {"type": "action", "name": "spotlight", "params": {"elementId": "img_1"}},
  {"type": "text", "content": "Hello students, let's look at this diagram..."},
  {"type": "action", "name": "wb_open"},
  {"type": "text", "content": "I'll draw the key formula on the board..."},
  {"type": "action", "name": "wb_draw_latex", "params": {"latex": "E=mc^2", "x": 100, "y": 100}}
]
```

---

## Playback Engine (`lib/playback/engine.ts`)

### State Machine

```
         start()                pause()
idle ──────────→ playing ──────────→ paused
  ▲                ▲                    │
  │                │  resume()          │
  │                └────────────────────┘
  │
  │  handleEndDiscussion()
  │                    confirmDiscussion()
  │                    / handleUserInterrupt()
  │                         │
  │                         ▼       pause()
  └──────────────────── live ──────────→ paused
                          ▲                 │
                          │ resume          │
                          └─────────────────┘
```

### Public API

| Method | Transition | Purpose |
|---|---|---|
| `start()` | idle → playing | Start from beginning |
| `continuePlayback()` | idle → playing | Resume after discussion |
| `pause()` | playing/live → paused | Pause (saves TTS state) |
| `resume()` | paused → playing/live | Resume (reschedules timers) |
| `stop()` | any → idle | Full reset |
| `confirmDiscussion()` | playing → live | User joins discussion |
| `skipDiscussion()` | — | Skip discussion prompt |
| `handleEndDiscussion()` | live → idle | End discussion, restore lecture |
| `handleUserInterrupt(text)` | playing/paused → live | User sends message mid-lecture |
| `getSnapshot()` | — | Serialize position for persistence |
| `restoreFromSnapshot()` | — | Restore position |

### Action Processing (`processNext()`)

- `speech` → TTS playback (audio player → browser TTS → reading timer fallback)
- `spotlight`/`laser` → Fire-and-forget via ActionEngine, continue immediately
- `discussion` → 3s delay → show ProactiveCard → wait for user
- `wb_*`, `widget_*`, `play_video` → Synchronous via ActionEngine, await completion

---

## Generation Pipeline

### Stage 1: Outline Generation (`lib/generation/outline-generator.ts`)

**Input**: `UserRequirements` (requirement text, PDF content, images)
**Output**: `{ languageDirective: string; outlines: SceneOutline[] }`

```typescript
interface UserRequirements {
  requirement: string;        // Free-form text
  userNickname?: string;
  userBio?: string;
  webSearch?: boolean;
  interactiveMode?: boolean;  // Enables interactive-first generation
}

interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  description: string;
  keyPoints: string[];
  order: number;
  quizConfig?: { questionCount, difficulty, questionTypes };
  interactiveConfig?: { conceptName, conceptOverview, designIdea };
  widgetType?: WidgetType;
  widgetOutline?: WidgetOutline;
  pblConfig?: { projectTopic, projectDescription, targetSkills };
  suggestedImageIds?: string[];
  mediaGenerations?: MediaGenerationRequest[];
}
```

### Stage 2: Scene Generation (`lib/generation/scene-generator.ts`)

Per-outline, generates full `Scene` with:
- **Slide**: PPTist-compatible `Slide` canvas (elements, background)
- **Quiz**: `QuizQuestion[]` (single/multiple/short_answer)
- **Interactive**: HTML string + optional `WidgetConfig` + `TeacherAction[]`
- **PBL**: `PBLProjectConfig`

Plus `Action[]` for playback (speech, spotlight, whiteboard, discussion).

---

## Provider System (`lib/ai/providers.ts`)

### Supported Providers (15+)

| Provider | SDK Type | Key Env Var |
|---|---|---|
| OpenAI | `openai` (native) | `OPENAI_API_KEY` |
| Anthropic | `anthropic` (native) | `ANTHROPIC_API_KEY` |
| Google Gemini | `google` (native) | `GOOGLE_API_KEY` |
| DeepSeek | `openai` (compatible) | `DEEPSEEK_API_KEY` |
| Qwen | `openai` (compatible) | `QWEN_API_KEY` |
| Kimi | `openai` (compatible) | `KIMI_API_KEY` |
| MiniMax | `anthropic` (compatible) | `MINIMAX_API_KEY` |
| GLM | `openai` (compatible) | `GLM_API_KEY` |
| SiliconFlow | `openai` (compatible) | `SILICONFLOW_API_KEY` |
| Doubao | `openai` (compatible) | `DOUBAO_API_KEY` |
| OpenRouter | `openai` (compatible) | `OPENROUTER_API_KEY` |
| Grok | `openai` (compatible) | `GROK_API_KEY` |
| Tencent | `openai` (compatible) | `TENCENT_API_KEY` |
| Xiaomi | `openai` (compatible) | `XIAOMI_API_KEY` |
| Ollama | `openai` (compatible) | — (local) |

### Env Var Pattern

```
{PROVIDER}_API_KEY=
{PROVIDER}_BASE_URL=       # Optional override
{PROVIDER}_MODELS=          # Optional comma-separated custom model list
```

### TTS/ASR/PDF/Image/Video Providers

```
TTS_{PROVIDER}_API_KEY=     # OpenAI, Azure, GLM, Qwen, MiniMax, ElevenLabs
ASR_{PROVIDER}_API_KEY=     # OpenAI, Qwen
PDF_{PROVIDER}_API_KEY=     # UnPDF, MinerU
IMAGE_{PROVIDER}_API_KEY=   # OpenAI, Seedream, Qwen, NanoBanana, MiniMax, Grok
VIDEO_{PROVIDER}_API_KEY=   # Seedance, Kling, Veo, Sora, MiniMax, Grok, HappyHorse
```

---

## Chat API — Stateless Architecture

### `POST /api/chat` (`app/api/chat/route.ts`)

**Key design**: Backend is fully stateless. All state lives in the client.

**Request body** (`StatelessChatRequest`):

```typescript
{
  messages: UIMessage[],           // Full conversation history
  storeState: {                    // Current app state
    stage: Stage | null,
    scenes: Scene[],
    currentSceneId: string | null,
    mode: 'autonomous' | 'playback',
    whiteboardOpen: boolean
  },
  config: {
    agentIds: string[],
    sessionType?: 'qa' | 'discussion',
    discussionTopic?: string,
    triggerAgentId?: string,
    agentConfigs?: AgentConfig[]    // Generated agent configs (travel with request)
  },
  directorState?: DirectorState,   // Accumulated from previous requests
  userProfile?: { nickname?, bio? },
  apiKey: string,
  model?: string,
  providerType?: string
}
```

**Response**: SSE stream of `StatelessEvent` objects.

**Flow**:
1. `resolveModel()` → get `LanguageModel` instance
2. `statelessGenerate()` → creates LangGraph, streams events
3. SSE with heartbeat (15s interval) to prevent timeout
4. Final `done` event includes updated `directorState`
5. Client accumulates `directorState` across requests

---

## Key Patterns & Conventions

### 1. Agent Config Resolution

```typescript
// Request-scoped overrides first, then global registry
function resolveAgent(state, agentId): AgentConfig | undefined {
  return state.agentConfigOverrides[agentId] ?? useAgentRegistry.getState().getAgent(agentId);
}
```

Generated agents travel with the request (no server-side persistence).

### 2. Streaming JSON Parser

The `parseStructuredChunk()` function incrementally parses a growing JSON array:
1. Skips prefix before `[` (markdown fences, explanatory text)
2. Uses `jsonrepair` first, falls back to `partial-json`
3. Emits complete items immediately
4. Streams partial text deltas for the trailing item
5. Maintains `ordered` array preserving original text↔action interleaving

### 3. Action Allowlisting

```typescript
// effectiveActions = static allowlist ∩ scene-type filter
const effectiveActions = getEffectiveActions(agentConfig.allowedActions, sceneType);
// spotlight/laser stripped for non-slide scenes (defense-in-depth)
```

### 4. Browser TTS Chunking

Speech text is split into sentence-level chunks to avoid Chrome's ~15s utterance cutoff bug. Uses cancel+re-speak pattern for Firefox-compatible pause/resume.

### 5. Whiteboard Coordinate System

All whiteboard positions use a **0–1000 × 0–562** coordinate system (16:9 aspect ratio).

### 6. Prompt Template System

```typescript
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
const prompts = buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES, { ...variables });
// Returns { system: string, user: string }
```

### 7. Zustand Store Pattern

```typescript
import { useMainStore } from '@/lib/store/main-store';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSettingsStore } from '@/lib/store/settings';
// Direct access without hooks (server-side or callbacks):
useCanvasStore.getState().setWhiteboardOpen(false);
```

---

## Common Tasks Cheat Sheet

### Add a new Action type

1. Define interface in `lib/types/action.ts` extending `ActionBase`
2. Add to `Action` union type
3. Add to `SYNC_ACTIONS` or `FIRE_AND_FORGET_ACTIONS` array
4. Handle in `PlaybackEngine.processNext()` switch
5. Implement in `ActionEngine.execute()`
6. Add to agent `allowedActions` in `tool-schemas.ts`
7. Describe in `prompt-builder.ts` action descriptions

### Add a new LLM Provider

1. Add to `PROVIDERS` record in `lib/ai/providers.ts`
2. Set `type: 'openai' | 'anthropic' | 'google'` (SDK adapter)
3. Define models with `capabilities`
4. Add env vars: `{ID}_API_KEY`, `{ID}_BASE_URL`, `{ID}_MODELS`
5. Add logo to `public/logos/`

### Add a new Widget type

1. Define config interface in `lib/types/widgets.ts`
2. Add to `WidgetType` union and `WidgetConfig` union
3. Add outline fields to `WidgetOutline` in `lib/types/generation.ts`
4. Create scene renderer in `components/scene-renderers/`
5. Add generation prompt in `lib/generation/prompts/`
6. Handle in `scene-generator.ts`

### Add a new Scene type

1. Add to `SceneType` union in `lib/types/stage.ts`
2. Define `XxxContent` interface, add to `SceneContent` union
3. Add outline config to `SceneOutline`
4. Handle in `outline-generator.ts` and `scene-generator.ts`
5. Create renderer component in `components/scene-renderers/`
6. Handle in stage component's scene dispatcher

### Modify agent prompts

- Agent system prompt: `lib/orchestration/prompt-builder.ts` → `buildStructuredPrompt()`
- Director decision prompt: `lib/orchestration/director-prompt.ts` → `buildDirectorPrompt()`
- Generation prompts: `lib/generation/prompts/` (Markdown templates)
- Action descriptions: `lib/orchestration/tool-schemas.ts`

---

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@langchain/langgraph` | ^1.1.1 | Multi-agent state graph |
| `@langchain/core` | ^1.1.16 | LangChain message types |
| `ai` (Vercel AI SDK) | ^6.0.168 | LLM provider abstraction |
| `@ai-sdk/openai` | ^3.0.53 | OpenAI + compatible providers |
| `@ai-sdk/anthropic` | ^3.0.71 | Claude + compatible providers |
| `@ai-sdk/google` | ^3.0.64 | Gemini provider |
| `partial-json` | ^0.1.7 | Streaming JSON parser |
| `jsonrepair` | ^3.13.2 | Fix malformed JSON |
| `zustand` | ^5.0.10 | Client state management |
| `katex` | ^0.16.33 | LaTeX rendering |
| `echarts` | ^6.0.0 | Chart rendering |
| `@xyflow/react` | ^12.10.0 | Mind map / diagram rendering |
| `shiki` | ^3.21.0 | Code syntax highlighting |
| `dexie` | ^4.2.1 | IndexedDB (client persistence) |
| `motion` | ^12.27.5 | Animations (Framer Motion) |
| `pptxgenjs` | workspace | PPTX export |
| `i18next` | ^26.0.1 | Internationalization |
| `mitt` | ^3.0.1 | Event emitter |
| `nanoid` | ^5.1.6 | ID generation |

---

## Gotchas & Edge Cases

1. **Stateless backend**: No database. All state (messages, director state, agent configs) travels with each request. Client accumulates `directorState` across chat turns.

2. **`maxTurns` is per-request**: Set to `turnCount + 1` — allows exactly one director→agent cycle per API call. Client loops externally for multi-turn.

3. **Agent config overrides**: Generated agents aren't in the server-side registry. They're passed in `request.config.agentConfigs` and resolved via `agentConfigOverrides`.

4. **Message role mapping**: `convertMessagesToOpenAI(messages, agentId)` maps other agents' messages to `user` role, current agent's previous messages to `assistant`.

5. **Trailing HumanMessage guard**: If message list doesn't end with HumanMessage, the graph appends "Please begin." or "It's your turn to speak."

6. **Playback interrupt timing**: `handleUserInterrupt()` sets mode BEFORE stopping audio — `speechSynthesis.cancel()` may fire onend synchronously.

7. **Scene-type action filtering**: `spotlight`/`laser` are stripped for non-slide scenes even if in static `allowedActions` (defense-in-depth).

8. **Chrome TTS bug**: Utterances >15s are silently cut off. Text is chunked at sentence boundaries.

9. **Discussion consumed tracking**: `consumedDiscussions` Set prevents re-triggering on replay.

10. **`queueMicrotask` for spotlight/laser**: Prevents stack overflow from deep synchronous recursion when many consecutive fire-and-forget actions appear.
