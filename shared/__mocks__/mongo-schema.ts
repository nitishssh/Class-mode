import { vi } from "vitest";

const saveMock = vi.fn().mockResolvedValue(true);

export function MongoUser(this: any, data: any) {
  Object.assign(this, data);
  this.save = saveMock;
}
MongoUser.findOne = vi.fn();
MongoUser.findOneAndUpdate = vi.fn();
MongoUser.save = saveMock;

export const getNextSequenceValue = vi.fn().mockResolvedValue(101);
export const MongoSession = { findOne: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn() };
export const MongoOtp = { findOne: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoTest = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoQuestion = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoTestAttempt = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoAnswer = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoAnalytics = { findOne: vi.fn(), find: vi.fn() };
export const MongoTestAssignment = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoWorkspace = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoChannel = { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() };
export const MongoMessage = {
  findOne: vi.fn(),
  find: vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
  }),
  findOneAndUpdate: vi.fn(),
};
