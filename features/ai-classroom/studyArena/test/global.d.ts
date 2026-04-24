declare namespace NodeJS {
  interface ProcessEnv {
    INICLAW_GATEWAY_URL?: string;
    BRIDGE_SECRET?: string;
    USE_INICLAW?: string;
  }
}

declare const process: NodeJS.Process;
declare const global: any;

declare module 'node:test' {
  export function test(name: string, fn: (t: any) => void | Promise<void>): void;
}

declare module 'node:assert' {
  export function strictEqual(actual: any, expected: any, message?: string): void;
  export function equal(actual: any, expected: any, message?: string): void;
  export function ok(value: any, message?: string): void;
  export const strict: typeof import('node:assert');
}
