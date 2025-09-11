import { EventEmitter } from "node:events";
import path from 'node:path';
import { Worker } from 'worker_threads';
import { logger } from '@/logger';


interface SetupEvents {
  'setup:started': [];
  'setup:succeeded': [];
  'setup:failed': [];

  'setup:uv:started': [];
  'setup:uv:succeeded': [{uvExecutablePath: string, uvVersion: string}];
  'setup:uv:failed': [];

  'setup:python:started': [];
  'setup:python:succeeded': [{pythonExecutablePath: string, pythonVersion: string}];
  'setup:python:failed': [];

  'setup:gtn:started': [];
  'setup:gtn:succeeded': [{gtnExecutablePath: string, gtnVersion: string}];
  'setup:gtn:failed': [];
}

const SETUP_EVENT_KEYS = [
  'setup:started',
  'setup:succeeded',
  'setup:failed',
  'setup:uv:started',
  'setup:uv:succeeded',
  'setup:uv:failed',
  'setup:python:started',
  'setup:python:succeeded',
  'setup:python:failed',
  'setup:gtn:started',
  'setup:gtn:succeeded',
  'setup:gtn:failed',
] as const;

type SetupEvent = (typeof SETUP_EVENT_KEYS)[number];

function isSetupEvent(x: unknown): x is SetupEvent {
  return typeof x === "string" &&
    (SETUP_EVENT_KEYS as readonly string[]).includes(x);
}


export class SetupService extends EventEmitter<SetupEvents> {
  private worker: Worker|null;

  constructor(
    private userDataPath: string,
    private logsPath: string,
  ) {
    super();
    this.worker = null;
  }
  
  async start() {
    this.worker = new Worker(path.join(__dirname, 'setup.js'), {
      workerData: {
        userDataPath: this.userDataPath,
        logsPath: this.logsPath,
      }
    });

    this.worker.on('message', (message) => {
      logger.warn(`[SETUP] message: ${JSON.stringify(message)}`);
      if (isSetupEvent(message.type)) {
        this.emit(message.type, message.payload);
      } else {
        logger.warn(`[SETUP] received non-setup event: ${message}`);
      }
    });

    this.worker.on('exit', (code) => {
      this.worker = null;

      if (code === 0) {
        this.emit('setup:succeeded');
      } else {
        this.emit('setup:failed');
      }
    });
  }
  
  async stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}