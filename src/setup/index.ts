import { parentPort, workerData } from 'worker_threads';
import { installUv } from './install-uv';
import { findPythonExecutablePath, installPython } from './install-python';
import { installGtn } from './install-gtn';
import { getGtnExecutablePath, getUvExecutablePath } from '../common/config/paths';
import { UvService } from '../common/services/uv-service';
import { PythonService } from '../common/services/python-service';
import { GtnService } from '../common/services/gtn-service';

async function setupWorkerMain() {
  const userDataPath = workerData?.userDataPath;
  if (!userDataPath) {
    parentPort.postMessage({ type: 'setup:failed' });
    throw new Error("workerData.userDataPath must be provided to worker.js");
  }
  const uvExecutablePath = await setupUv(userDataPath);
  await setupPython(userDataPath, uvExecutablePath);
  await setupGtn(userDataPath, uvExecutablePath);
}

async function setupUv(userDataPath: string): Promise<string> {
  parentPort.postMessage({ type: 'setup:uv:started' });
  try {
    await installUv(userDataPath);
    const uvExecutablePath = getUvExecutablePath(userDataPath);
    const uvVersion = await new UvService(userDataPath).getUvVersion()
    parentPort.postMessage({
      type: 'setup:uv:succeeded',
      payload: {
        uvExecutablePath,
        uvVersion,
      }
    });
    return uvExecutablePath;
  } catch (e) {
    parentPort.postMessage({ type: 'setup:uv:failed' });
    throw e;
  }
}

async function setupPython(userDataPath: string, uvExecutablePath: string) {
  parentPort.postMessage({ type: 'setup:python:started' });
  try {
    await installPython(userDataPath, uvExecutablePath);
    const pythonExecutablePath = await findPythonExecutablePath(userDataPath, uvExecutablePath);
    const pythonVersion = await new PythonService(userDataPath, pythonExecutablePath).getPythonVersion();
    parentPort.postMessage({
      type: 'setup:python:succeeded',
      payload: {
        pythonExecutablePath,
        pythonVersion,
      }
    });
  } catch (e) {
    parentPort.postMessage({ type: 'setup:python:failed' });
    throw e;
  }
}

async function setupGtn(userDataPath: string, uvExecutablePath: string) {
  parentPort.postMessage({ type: 'setup:gtn:started' });
  try {
    await installGtn(userDataPath, uvExecutablePath);
    const gtnExecutablePath = getGtnExecutablePath(userDataPath);
    const gtnVersion = await new GtnService(userDataPath, '', gtnExecutablePath).getGtnVersion();
    parentPort.postMessage({
      type: 'setup:gtn:succeeded',
      payload: {
        gtnExecutablePath,
        gtnVersion,
      }
    });
  } catch (e) {
    parentPort.postMessage({ type: 'setup:gtn:failed', payload: e });
    throw e;
  }
}

setupWorkerMain();
