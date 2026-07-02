import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatResult } from "@langchain/core/outputs";
import { generate, streamGenerate } from "../../lib/ai/gateway";
import { StreamChunk } from "./ai-sdk-adapter";

/**
 * Gemini LangGraph Adapter
 */
export class GeminiLangGraphAdapter extends BaseChatModel {
  constructor() {
    super({});
  }

  _llmType(): string {
    return "internal-gemini";
  }

  _combineLLMOutput() {
    return {};
  }

  private convertMessages(messages: BaseMessage[]): { role: string; content: string }[] {
    return messages.map((msg) => {
      let role = "user";
      if (msg instanceof HumanMessage) role = "user";
      else if (msg instanceof AIMessage) role = "assistant";
      else if (msg instanceof SystemMessage) role = "system";

      return { role, content: String(msg.content) };
    });
  }

  async _generate(
    messages: BaseMessage[],
    _options?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const geminiMessages = this.convertMessages(messages);
    const systemInstruction = geminiMessages.find((m) => m.role === "system")?.content || "";
    const userPrompt = geminiMessages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const content = await generate({
      model: "fast",
      system: systemInstruction,
      messages: [{ role: "user", content: userPrompt }],
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
    const geminiMessages = this.convertMessages(messages);
    const systemInstruction = geminiMessages.find((m) => m.role === "system")?.content || "";
    const userPrompt = geminiMessages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    let fullContent = "";
    const stream = streamGenerate({
      model: "fast",
      system: systemInstruction,
      messages: [{ role: "user", content: userPrompt }],
      feature: "study_arena_director",
    });

    for await (const chunk of stream) {
      fullContent += chunk;
      yield { type: "delta", content: chunk };
    }

    yield { type: "done", content: fullContent };
  }

  getModel() {
    return this;
  }
}
