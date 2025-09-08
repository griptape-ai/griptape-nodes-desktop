import { parentPort, workerData } from 'worker_threads';
import { PythonService } from '../../main/services/python';
import { EnvironmentSetupService } from '../../main/services/environment-setup';

async function runSetup() {
  try {
    console.log('[SETUP WORKER] Starting post-installation setup...');
    console.log('[SETUP WORKER] Worker data:', workerData);
    
    if (!workerData?.userDataPath || !workerData?.resourcesPath) {
      throw new Error('userDataPath and resourcesPath must be provided in workerData');
    }
    
    console.log('[SETUP WORKER] Using resourcesPath:', workerData.resourcesPath);
    console.log('[SETUP WORKER] Using userDataPath:', workerData.userDataPath);
    const pythonService = new PythonService(workerData.resourcesPath, workerData.userDataPath);
    // Use the paths from main process
    const environmentSetupService = new EnvironmentSetupService(pythonService, workerData.userDataPath, workerData.resourcesPath);
    
    const pythonReady = pythonService.isReady();
    console.log('[SETUP WORKER] Python service ready:', pythonReady);
    if (!pythonReady) {
      parentPort?.postMessage({ 
        type: 'error', 
        message: 'Python service is not ready - Python may not be available' 
      });
      return;
    }

    // Run post-install setup and collect environment info
    console.log('[SETUP WORKER] Running post-install setup...');
    const envInfo = await environmentSetupService.runPostInstallSetup();
    console.log('[SETUP WORKER] Post-install setup completed. Griptape-nodes installed:', envInfo.griptapeNodes.installed);
    
    // Report results
    if (envInfo.errors.length > 0) {
      console.warn('[SETUP WORKER] Setup completed with warnings:', envInfo.errors);
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
    console.error('[SETUP WORKER] Error during setup:', error);
    parentPort?.postMessage({ 
      type: 'error', 
      message: `Failed to complete post-installation setup: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}

runSetup();