/**
 * Orchestrator — Entry point for multi-agent stateless chat.
 * 
 * Ported from features/ai-classroom/studyArena/lib/orchestration/stateless-generate.ts
 */

import { createOrchestrationGraph, buildInitialState } from './director-graph';
import { StatelessChatRequest, StatelessEvent } from '@shared/study-arena';
import { parse as parsePartialJson, Allow } from 'partial-json';
import { jsonrepair } from 'jsonrepair';

// ==================== Structured Output Parser ====================

interface ParserState {
  buffer: string;
  jsonStarted: boolean;
  lastParsedItemCount: number;
  lastPartialTextLength: number;
  isDone: boolean;
}

export function createParserState(): ParserState {
  return {
    buffer: '',
    jsonStarted: false,
    lastParsedItemCount: 0,
    lastPartialTextLength: 0,
    isDone: false,
  };
}

export interface ParseResult {
  textChunks: string[];
  actions: any[];
  isDone: boolean;
  ordered: Array<{ type: 'text'; index: number } | { type: 'action'; index: number }>;
}

export function parseStructuredChunk(chunk: string, state: ParserState): ParseResult {
  const result: ParseResult = {
    textChunks: [],
    actions: [],
    isDone: false,
    ordered: [],
  };

  if (state.isDone) return result;
  state.buffer += chunk;

  if (!state.jsonStarted) {
    const bracketIndex = state.buffer.indexOf('[');
    if (bracketIndex === -1) return result;
    state.buffer = state.buffer.slice(bracketIndex);
    state.jsonStarted = true;
  }

  const trimmed = state.buffer.trimEnd();
  const isArrayClosed = trimmed.endsWith(']') && trimmed.length > 1;

  let parsed: any[];
  try {
    const repaired = jsonrepair(state.buffer);
    parsed = JSON.parse(repaired);
  } catch {
    try {
      parsed = parsePartialJson(
        state.buffer,
        Allow.ARR | Allow.OBJ | Allow.STR | Allow.NUM | Allow.BOOL | Allow.NULL,
      );
    } catch {
      return result;
    }
  }

  if (!Array.isArray(parsed)) return result;

  const completeUpTo = isArrayClosed ? parsed.length : Math.max(0, parsed.length - 1);

  for (let i = state.lastParsedItemCount; i < completeUpTo; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') continue;

    if (item.type === 'text') {
      const content = item.content || '';
      const finalContent = i === state.lastParsedItemCount && state.lastPartialTextLength > 0
        ? content.slice(state.lastPartialTextLength)
        : content;
      
      if (finalContent) {
        result.textChunks.push(finalContent);
        result.ordered.push({ type: 'text', index: result.textChunks.length - 1 });
      }
      state.lastPartialTextLength = 0;
    } else if (item.type === 'action') {
      result.actions.push({
        actionId: item.action_id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        actionName: item.name || item.tool_name,
        params: item.params || item.parameters || {},
      });
      result.ordered.push({ type: 'action', index: result.actions.length - 1 });
    }
  }

  state.lastParsedItemCount = completeUpTo;

  if (!isArrayClosed && parsed.length > completeUpTo) {
    const lastItem = parsed[parsed.length - 1];
    if (lastItem?.type === 'text') {
      const content = lastItem.content || '';
      if (content.length > state.lastPartialTextLength) {
        result.textChunks.push(content.slice(state.lastPartialTextLength));
        state.lastPartialTextLength = content.length;
      }
    }
  }

  if (isArrayClosed) {
    state.isDone = true;
    result.isDone = true;
  }

  return result;
}

// ==================== Main Orchestrator ====================

export async function* orchestrateChat(
  request: StatelessChatRequest,
  abortSignal?: AbortSignal,
): AsyncGenerator<StatelessEvent> {
  try {
    const graph = createOrchestrationGraph();
    const initialState = buildInitialState(request);

    const stream = await graph.stream(initialState, {
      streamMode: 'custom' as any,
      signal: abortSignal,
    });

    for await (const chunk of stream) {
      yield chunk as StatelessEvent;
    }
  } catch (error) {
    console.error('[OrchestrateChat] Error:', error);
    yield { type: 'error', data: { message: String(error) } };
  }
}
