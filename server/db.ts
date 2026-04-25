import mongoose from "mongoose";

// MongoDB Connection
if (!process.env.MONGODB_URL) {
  console.warn("MONGODB_URL environment variable is not set. MongoDB features may be unavailable.");
}

// Connection health tracking
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Connection health events
mongoose.connection.on("connected", () => {
  console.info("[MongoDB] connected successfully");
  isConnected = true;
  reconnectAttempts = 0;
});

mongoose.connection.on("error", (err) => {
  console.error("[MongoDB] connection error:", err);
  isConnected = false;
});

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB] disconnected");
  isConnected = false;

  // Attempt reconnection with exponential backoff
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.info(
      `[MongoDB] attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
    );
    setTimeout(() => connectMongoDB(), delay);
  }
});

mongoose.connection.on("reconnected", () => {
  console.info("[MongoDB] reconnected");
  isConnected = true;
  reconnectAttempts = 0;
});

export const connectMongoDB = async () => {
  if (!process.env.MONGODB_URL) return;
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      tls: process.env.MONGODB_URL.includes("+srv"),
      tlsAllowInvalidCertificates: process.env.MONGODB_URL.includes("+srv") ? true : undefined,
      // Connection pool configuration
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Retry configuration
      retryWrites: true,
      retryReads: true,
    });
    console.log("MongoDB Connected...");
    isConnected = true;
  } catch (err) {
    console.error("MongoDB connection error (non-fatal, server will continue):", err);
    isConnected = false;
    // Do not exit — server can still serve the app without MongoDB
  }
};

export const isMongoConnected = () => isConnected;
