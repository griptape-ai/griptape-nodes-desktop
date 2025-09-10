import { workerData } from 'worker_threads';
import { installUv } from '../../main/services/setup/install-uv';
import { UvService } from '../../main/services/uv-service';

async function runSetup() {
  console.log('[SETUP WORKER] Starting post-installation setup...');
  if (!workerData) {
    throw new Error("workerData must be provided to worker.js")
  }
  if (!workerData.userDataPath) {
    throw new Error("userDataPath must be provided to worker.js")
  }
  if (!workerData.gtnDefaultWorkspaceDir) {
    throw new Error("gtnDefaultWorkspaceDir must be provided to worker.js")
  }
  
  const userDataPath = workerData.userDataPath;
  const gtnDefaultWorkspaceDir = workerData.gtnDefaultWorkspaceDir;

  
  console.log('[SETUP WORKER] Worker data:', workerData);
  console.log('[SETUP WORKER] Using userDataPath:', userDataPath);
  console.log('[SETUP WORKER] Using gtnDefaultWorkspaceDir:', gtnDefaultWorkspaceDir);

  // TODO: PythonService is a horrible abstraction for this collection of methods.
  const uvService = new UvService(userDataPath);
  
  ////////
  // UV //
  ////////

  console.log("Installing uv...")
  const uvExecutable = await installUv(userDataPath);
  const uvVersion = uvService.getUvVersion();


  // ////////////
  // // Python //
  // ////////////

  // console.log("Installing python...");
  // await installPython(uvExecutable, userDataPath);
  // const pythonExecutablePath = pythonService.getPythonExecutablePath();
  // if (!pythonExecutablePath) {
  //   throw new Error('Python failed to install correctly, pythonExecutablePath was null');
  // }
  // const pythonVersion = pythonService.execPythonSync('import sys; print(sys.version)');


  // ////////////////////
  // // Griptape Nodes //
  // ////////////////////

  // console.log("Installing griptape-nodes")
  // await installGtn(uvExecutable, userDataPath);
  // const gtnExecutablePath = pythonService.getGriptapeNodesPath();
  // if (!gtnExecutablePath) {
  //   throw new Error("Griptape nodes failed to install correctly, gtnExecutablePath was null");
  // }
  // const gtnVersion = pythonService.getGriptapeNodesVersion();
  // if (!gtnVersion) {
  //   throw new Error("Griptape nodes failed to install correctly, gtnVersion was null");
  // }


  // //////////////////
  // // Persist Info //
  // //////////////////
  
  // console.log("Saving environment info...")
  // const environmentInfoService = new EnvironmentInfoService(pythonService, userDataPath);
  // environmentInfoService.saveEnvironmentInfo({
  //   python: {
  //     version: pythonVersion,
  //     executable: pythonExecutablePath,
  //   },
  //   griptapeNodes: {
  //     path: gtnExecutablePath,
  //     version: gtnVersion,
  //     installed: true
  //   },
  //   uv: {
  //     version: uvVersion,
  //     toolDir: getUvToolDir(userDataPath),
  //     pythonInstallDir: getPythonInstallDir(userDataPath)
  //   },
  //   system: {
  //     platform: process.platform,
  //     arch: process.arch,
  //     nodeVersion: process.version,
  //     electronVersion: process.versions.electron || 'Unknown'
  //   },
  //   collectedAt: new Date().toISOString(),
  //   errors: [],
  // });
}

runSetup();
