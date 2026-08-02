/**
 *
 * 42 bits for timestamp (ms since epoch)
 * 5 bits for worker ID
 * 5 bits for process ID
 * 12 bits for sequence number
 */
export class Snowflake {
  private static readonly EPOCH = 1704067200000; // 2024-01-01T00:00:00Z
  private static readonly WORKER_BITS = 5;
  private static readonly PROCESS_BITS = 5;
  private static readonly SEQUENCE_BITS = 12;

  private static readonly MAX_WORKER_ID = -1 ^ (-1 << Snowflake.WORKER_BITS);
  private static readonly MAX_PROCESS_ID = -1 ^ (-1 << Snowflake.PROCESS_BITS);
  private static readonly MAX_SEQUENCE = -1 ^ (-1 << Snowflake.SEQUENCE_BITS);

  private static readonly WORKER_ID_SHIFT = Snowflake.SEQUENCE_BITS;
  private static readonly PROCESS_ID_SHIFT = Snowflake.SEQUENCE_BITS + Snowflake.WORKER_BITS;
  private static readonly TIMESTAMP_SHIFT =
    Snowflake.SEQUENCE_BITS + Snowflake.WORKER_BITS + Snowflake.PROCESS_BITS;

  private workerId: number;
  private processId: number;
  private sequence: number = 0;
  private lastTimestamp: number = -1;

  constructor(workerId: number = 0, processId: number = 0) {
    if (workerId > Snowflake.MAX_WORKER_ID || workerId < 0) {
      throw new Error(`Worker ID must be between 0 and ${Snowflake.MAX_WORKER_ID}`);
    }
    if (processId > Snowflake.MAX_PROCESS_ID || processId < 0) {
      throw new Error(`Process ID must be between 0 and ${Snowflake.MAX_PROCESS_ID}`);
    }
    this.workerId = workerId;
    this.processId = processId;
  }

  public nextId(): string {
    let timestamp = Date.now();

    if (timestamp < this.lastTimestamp) {
      throw new Error("Clock moved backwards. Refusing to generate ID.");
    }

    if (this.lastTimestamp === timestamp) {
      this.sequence = (this.sequence + 1) & Snowflake.MAX_SEQUENCE;
      if (this.sequence === 0) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    const id =
      (BigInt(timestamp - Snowflake.EPOCH) << BigInt(Snowflake.TIMESTAMP_SHIFT)) |
      (BigInt(this.processId) << BigInt(Snowflake.PROCESS_ID_SHIFT)) |
      (BigInt(this.workerId) << BigInt(Snowflake.WORKER_ID_SHIFT)) |
      BigInt(this.sequence);

    return id.toString();
  }

  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }
}

export const snowflake = new Snowflake(1, 1);
