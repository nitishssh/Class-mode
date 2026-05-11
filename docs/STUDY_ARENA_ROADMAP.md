# Study Arena Future Features Implementation Roadmap

This document serves as an architectural blueprint for adding advanced AI classroom capabilities natively to the Study Arena, completely leveraging the internal backend (`server/services/study-arena/`) and the lightweight `IniClaw` LLM gateway.

## 1. Text-to-Speech (TTS) & Speech Recognition (ASR)

**Goal:** Enable vocal interactions. The AI teacher and assistants can speak their dialogue, and the user can talk back using their microphone.

### Architecture
- **TTS Generation:** Integrate an external provider like ElevenLabs, OpenAI TTS, or Google Cloud TTS via `server/services/study-arena/audio-service.ts`.
- **Playback Sync:** When `orchestrator.ts` generates dialogue events (`text_delta`), trigger TTS generation asynchronously. Send audio URLs down to the client via Server-Sent Events (SSE) alongside text.
- **ASR (Speech-to-Text):** Utilize the browser's native `SpeechRecognition` API (Web Speech API) or OpenAI Whisper API. If using Whisper, add a route `/api/ai-classroom/transcribe` that accepts audio blobs and forwards them to IniClaw.

### IniClaw Updates
- Add a new proxy route `/audio/transcribe` in `features/ai-classroom/ini_claw/gateway.js`.
- Add a proxy route for `/audio/speech` (TTS).

---

## 2. Real-time Multi-Agent Whiteboard

**Goal:** Allow multiple AI agents (e.g., teacher and assistant) to dynamically draw flowcharts, math equations, and diagrams on a shared whiteboard during chat.

### Architecture
- **State Management:** The whiteboard state must be shared and appended to. `shared/study-arena.ts` already has `WhiteboardActionRecord`.
- **Agent Actions:** In `director-prompt.ts`, extend the allowed JSON tool calls to include `draw_shape`, `draw_text`, `draw_arrow`, `clear_board`.
- **Frontend Rendering:** Implement an SVG-based whiteboard component in `client/src/components/study-arena/Whiteboard.tsx`. When the frontend receives an `action` event of type `draw_*` from the SSE stream, it animates the drawing on the SVG canvas.

### Implementation Steps
1. Update `AgentInfo` in `types.ts` to ensure tools for drawing are strictly defined.
2. In the React frontend, maintain a local `Zustand` store for whiteboard elements.

---

## 3. Presentation Export (PowerPoint & HTML)

**Goal:** Allow users to export generated AI classroom slides to `.pptx` or interactive self-contained `.html`.

### Architecture
- **PPTX Generation:** Add a package like `pptxgenjs` to the backend. Create a new service `server/services/study-arena/export-service.ts`.
- **Data Mapping:** Translate the MongoAIClassroom slide schema (text, images, bullet points) into `PptxGenJS` slide objects.
- **API Endpoint:** Create `/api/ai-classroom/export/:id?format=pptx` that generates the file buffer and returns it with a `Content-Disposition: attachment` header.

---

## 4. Web Search Integration for Agents

**Goal:** Allow the AI agents to pull real-time data from the web (e.g., current stock prices, recent news) when generating lessons or chatting.

### Architecture
- **Tool Definition:** Add a `web_search` tool to `ai-sdk-adapter.ts` and `gemini-adapter.ts`.
- **Search Provider:** Use a provider like Tavily API, Serper.dev, or DuckDuckGo.
- **IniClaw Update:** Create a `/tools/search` route in IniClaw to rate-limit search API queries. Agents will pause generation, execute the search tool via IniClaw, inject the results into context, and resume generating.

---

## 5. Project-Based Learning (PBL) Modes

**Goal:** Structured, multi-stage projects where the user selects a role, and the AI guides them through milestones (e.g., building a website, analyzing a dataset).

### Architecture
- **Schema Updates:** Add `pbl` to `SceneType` in `shared/study-arena.ts` (already present!). Define a new Mongo schema `MongoAIPBLJob` to track milestones, tasks, and completion status.
- **State Machine:** In `orchestrator.ts`, create a distinct branch for PBL mode that validates milestone completion before allowing progression.
- **Frontend UI:** Build a specialized `PBLDashboard.tsx` showing a progress tree, current tasks, and an embedded code editor or artifact viewer.

---

## Summary of Next Steps for Development

1. **Phase 1:** Implement Whiteboard actions in `director-prompt.ts` and build the SVG React component. (Highest visual impact).
2. **Phase 2:** Integrate TTS playback streaming in the `orchestrator.ts` SSE pipeline.
3. **Phase 3:** Build the `/export` API using `PptxGenJS`.
