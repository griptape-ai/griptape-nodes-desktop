import { parentPort } from 'worker_threads';
import { PythonService } from '../../main/services/python';

const pythonService = new PythonService();

async function runSetup() {
  try {
    console.log('Setup worker: Starting griptape-nodes installation...');
    
    if (pythonService.isReady()) {
      await pythonService.ensureGriptapeNodes();
      parentPort?.postMessage({ 
        type: 'success', 
        message: 'griptape-nodes setup complete' 
      });
    } else {
      parentPort?.postMessage({ 
        type: 'error', 
        message: 'Python service is not ready - Python may not be available' 
      });
    }
  } catch (error) {
    parentPort?.postMessage({ 
      type: 'error', 
      message: `Failed to setup griptape-nodes: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}

runSetup();