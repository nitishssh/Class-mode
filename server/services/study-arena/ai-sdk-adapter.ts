/**
 * AI SDK Adapter for LangGraph — Internal Port
 *
 * Adapts the project's OpenAI lib to be compatible with LangChain/LangGraph.
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatResult } from "@langchain/core/outputs";
import { generate, streamGenerate } from "../../lib/ai/gateway";

export type StreamChunk = { type: "delta"; content: string } | { type: "done"; content: string };

export class AISdkLangGraphAdapter extends BaseChatModel {
  constructor() {
    super({});
  }

  _llmType(): string {
    return "internal-openai";
  }

  _combineLLMOutput() {
    return {};
  }

  private convertMessages(messages: BaseMessage[]): any[] {
    return messages.map((msg) => {
      if (msg instanceof HumanMessage) return { role: "user", content: msg.content };
      if (msg instanceof AIMessage) return { role: "assistant", content: msg.content };
      if (msg instanceof SystemMessage) return { role: "system", content: msg.content };
      return { role: "user", content: String(msg.content) };
    });
  }

  async _generate(
    messages: BaseMessage[],
    _options?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const openaiMessages = this.convertMessages(messages);
    const content = await generate({
      model: "orchestrator",
      messages: openaiMessages,
      feature: "study_arena_director",
    });
    const aiMessage = new AIMessage({ content });

    return {
      generations: [{ text: content, message: aiMessage }],
      llmOutput: {},
    };
  }

  async *streamGenerate(
    messages: BaseMessage[],
    _options?: { signal?: AbortSignal }
  ): AsyncGenerator<StreamChunk> {
    const openaiMessages = this.convertMessages(messages);
    let fullContent = "";

    const stream = streamGenerate({
      model: "orchestrator",
      messages: openaiMessages,
      feature: "study_arena_director",
    });
    for await (const chunk of stream) {
      fullContent += chunk;
      yield { type: "delta", content: chunk };
    }

    yield { type: "done", content: fullContent };
  }
}
