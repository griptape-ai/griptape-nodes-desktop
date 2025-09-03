import { parentPort, workerData } from 'worker_threads';
import { PythonService } from '../../main/services/python';
import { EnvironmentSetupService } from '../../main/services/environment-setup';

async function runSetup() {
  try {
    console.log('Setup worker: Starting post-installation setup...');
    
    if (!workerData?.userDataPath) {
      throw new Error('userDataPath must be provided in workerData');
    }
    
    const pythonService = new PythonService();
    // Use the userData path from main process
    const environmentSetupService = new EnvironmentSetupService(pythonService, workerData.userDataPath);
    
    if (!pythonService.isReady()) {
      parentPort?.postMessage({ 
        type: 'error', 
        message: 'Python service is not ready - Python may not be available' 
      });
      return;
    }

    // Run post-install setup and collect environment info
    const envInfo = await environmentSetupService.runPostInstallSetup();
    
    // Report results
    if (envInfo.errors.length > 0) {
      console.warn('Setup completed with warnings:', envInfo.errors);
      parentPort?.postMessage({ 
        type: 'partial', 
        message: 'Post-installation setup completed with warnings',
        data: envInfo
      });
    } else {
      parentPort?.postMessage({ 
        type: 'success', 
        message: 'Post-installation setup completed successfully',
        data: envInfo
      });
    }
  } catch (error) {
    parentPort?.postMessage({ 
      type: 'error', 
      message: `Failed to complete post-installation setup: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}

runSetup();