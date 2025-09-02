import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../../lib/utils';

const Settings: React.FC = () => {
  const { apiKey } = useAuth();
  const [pythonInfo, setPythonInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadPythonInfo();
  }, []);

  const loadPythonInfo = async () => {
    try {
      const result = await window.pythonAPI.getPythonInfo();
      setPythonInfo(result);
    } catch (error) {
      console.error('Failed to load Python info:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      alert('API Key copied to clipboard!');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* API Key Section */}
      {apiKey && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Griptape Cloud API Key</h2>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                readOnly
                className={cn(
                  "flex-1 px-3 py-2 text-sm rounded-md",
                  "bg-background border border-input",
                  "font-mono"
                )}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className={cn(
                  "px-4 py-2 text-sm rounded-md",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/80 transition-colors"
                )}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={copyApiKey}
                className={cn(
                  "px-4 py-2 text-sm rounded-md",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors"
                )}
              >
                Copy
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              This API key provides access to Griptape Cloud services. Keep it secure!
            </p>
          </div>
        </div>
      )}

      {/* Python Information */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Python Information</h2>
        {loading ? (
          <p className="text-muted-foreground">Loading Python information...</p>
        ) : pythonInfo ? (
          <>
            {pythonInfo.success ? (
              <div className="space-y-4">
                <div className="bg-muted rounded-md p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Bundled Version:</span> {pythonInfo.version}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Executable Path:</span> {pythonInfo.executable}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Python Command Output:</p>
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto">
                    {pythonInfo.versionOutput}
                  </pre>
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto">
                    {pythonInfo.pathOutput}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-destructive">Error: {pythonInfo.error}</p>
            )}
          </>
        ) : (
          <p className="text-destructive">Failed to load Python information</p>
        )}
      </div>

      {/* Griptape Nodes Information */}
      {pythonInfo && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Griptape Nodes Information</h2>
          <div className="bg-muted rounded-md p-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium">Executable Path:</span> {pythonInfo.griptapeNodesPath}
            </p>
            <p className="text-sm">
              <span className="font-medium">Version:</span> {pythonInfo.griptapeNodesVersion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;