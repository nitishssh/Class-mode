import "dotenv/config";
import { storage } from "../server/storage";
import { initCassandra } from "../server/lib/cassandra";

async function test() {
  console.log("Starting Cassandra-only test...");

  // Initialize Cassandra
  await initCassandra();

  const testChannelId = "test-channel-123";
  const testMessage = {
    channelId: testChannelId,
    authorId: 1,
    content: "Hello from Astra DB! " + new Date().toISOString(),
    attachments: [],
  };

  try {
    console.log("Attempting to create message in Cassandra...");
    const created = await storage.createMessage(testMessage as any);
    console.log("Message created successfully:", created);

    console.log("Attempting to retrieve messages for channel...");
    const messages = await storage.getMessagesByChannel(testChannelId);
    console.log("Retrieved messages:", messages);

    if (messages.length > 0 && messages[messages.length - 1].content === testMessage.content) {
      console.log("SUCCESS: Cassandra integration is working!");
    } else {
      console.log("FAILURE: Message not found or content mismatch.");
    }
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    process.exit(0);
  }
}

test();
