import { EventEmitter } from "node:events";

type Events = {
  "app:ready": {},

  "setup:uv:start": {},
  "setup:uv:success": {},
  "setup:uv:failure": {},

  "setup:python:start": {},
  "setup:python:success": {},
  "setup:python:failure": {},

  "setup:gtn:start": {},
  "setup:gtn:success": {},
  "setup:gtn:failure": {},

  "install:done": { ok: true };
  "apiKey:ready": { apiKey: string };
  "init:done": { ok: true };
  "longRunner:crashed": { code: number | null; signal: string | null };
  "longRunner:stopped": {};
  "user:start-long-runner": {};
  "user:stop-long-runner": {};
};

export class Bus extends EventEmitter {
  emit<T extends keyof Events>(event: T, payload: Events[T]): boolean {
    return super.emit(event, payload);
  }
  on<T extends keyof Events>(event: T, listener: (payload: Events[T]) => void) {
    return super.on(event, listener);
  }
  once<T extends keyof Events>(
    event: T,
    listener: (payload: Events[T]) => void
  ) {
    return super.once(event, listener);
  }
}
