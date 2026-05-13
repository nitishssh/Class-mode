import { getCassandraClient } from "../lib/cassandra";
import { CassandraMessageStore } from "./cassandra-message-store";
import { MessageStore } from "./message-store";
import type { IMessageStore } from "./types";

let store: IMessageStore | null = null;

export function createMessageStore(): IMessageStore {
  if (store) return store;

  if (getCassandraClient()) {
    store = new CassandraMessageStore();
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[MessagePal] ASTRA_DB_APPLICATION_TOKEN not set — using in-memory store. " +
          "Messages will be lost on restart."
      );
    }
    store = new MessageStore();
  }

  return store;
}
