/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

// Declare the API that will be exposed by the preload script
declare global {
  interface Window {
    pythonAPI: {
      getPythonInfo: () => Promise<{
        success: boolean;
        version?: string;
        executable?: string;
        versionOutput?: string;
        pathOutput?: string;
        griptapeNodesPath?: string;
        griptapeNodesVersion?: string;
        error?: string;
      }>;
    };
  }
}

async function displayPythonInfo() {
  const pythonInfoElement = document.getElementById('python-info');
  if (!pythonInfoElement) return;

  try {
    pythonInfoElement.innerHTML = '<p>Loading Python information...</p>';
    
    const result = await window.pythonAPI.getPythonInfo();
    
    if (result.success) {
      pythonInfoElement.innerHTML = `
        <h2>Python Information</h2>
        <div style="font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px;">
          <p><strong>Bundled Version:</strong> ${result.version}</p>
          <p><strong>Executable Path:</strong> ${result.executable}</p>
          <hr>
          <p><strong>Python Command Output:</strong></p>
          <pre>${result.versionOutput}</pre>
          <pre>${result.pathOutput}</pre>
        </div>
        
        <h2>Griptape Nodes Information</h2>
        <div style="font-family: monospace; background: #f0f8ff; padding: 10px; border-radius: 4px;">
          <p><strong>Executable Path:</strong> ${result.griptapeNodesPath}</p>
          <p><strong>Version:</strong> ${result.griptapeNodesVersion}</p>
        </div>
      `;
    } else {
      pythonInfoElement.innerHTML = `
        <h2>Python Information</h2>
        <p style="color: red;">Error: ${result.error}</p>
        <p>Python may not be available yet. Try refreshing the page.</p>
      `;
    }
  } catch (error) {
    pythonInfoElement.innerHTML = `
      <h2>Python Information</h2>
      <p style="color: red;">Failed to get Python information: ${error}</p>
    `;
  }
}

// Load Python info when the page loads
document.addEventListener('DOMContentLoaded', displayPythonInfo);
