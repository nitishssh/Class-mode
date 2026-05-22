import "dotenv/config";
import { orchestrateChat } from "../server/services/study-arena/orchestrator";
import { StatelessChatRequest } from "../shared/study-arena";
import { logger } from "../server/lib/logger";

async function testStream() {
  const mockRequest: StatelessChatRequest = {
    config: {
      agentIds: ["teacher", "peer"],
      agentConfigs: [
        {
          id: "teacher",
          name: "Dr. Smith",
          role: "teacher",
          persona: "Encouraging and precise",
          avatar: "👨‍🏫",
          color: "#3b82f6",
          pblConfig: { focus: "Quantum Mechanics" },
        },
        {
          id: "peer",
          name: "Alex",
          role: "peer",
          persona: "Curious student",
          avatar: "👦",
          color: "#10b981",
          pblConfig: { focus: "Questions" },
        },
      ],
      discussionTopic: "Introduction to Schrödinger Equation",
      enableTTS: false,
    },
    messages: [
      {
        role: "user",
        content: "Hello everyone, can you explain the basis of the Schrödinger equation?",
      },
    ],
    storeState: {
      whiteboardOpen: true,
      currentView: "whiteboard",
    },
  };

  console.log("--- Starting Orchestration Stream Test ---");

  try {
    const stream = orchestrateChat(mockRequest);

    let eventCount = 0;
    for await (const event of stream) {
      eventCount++;
      if (event.type === "text_delta") {
        process.stdout.write(event.data.content);
      } else if (event.type === "agent_start") {
        console.log(`\n\n[Agent Start: ${event.data.agentName}]`);
      } else if (event.type === "action") {
        console.log(`\n[Action: ${event.data.actionName}]`, JSON.stringify(event.data.params));
      } else if (event.type === "thinking") {
        console.log(`\n[Thinking: ${event.data.stage}]`);
      }

      if (eventCount > 50) break; // Limit for test
    }
  } catch (error) {
    console.error("Test Failed:", error);
  }
}

testStream();
