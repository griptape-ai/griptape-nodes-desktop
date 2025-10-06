import React, { useState, useEffect } from 'react';
import { Folder, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/utils';

interface WorkspaceSetupProps {
  onComplete: (workspaceDirectory: string) => void;
}

const WorkspaceSetup: React.FC<WorkspaceSetupProps> = ({ onComplete }) => {
  const [workspaceDirectory, setWorkspaceDirectory] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    // Load the default workspace directory
    const loadDefaultWorkspace = async () => {
      try {
        const directory = await window.griptapeAPI.getDefaultWorkspace();
        setWorkspaceDirectory(directory);
      } catch (error) {
        console.error('Failed to load default workspace directory:', error);
      }
    };
    loadDefaultWorkspace();
  }, []);

  const handleBrowse = async () => {
    try {
      const directory = await window.griptapeAPI.selectDirectory();
      if (directory) {
        setWorkspaceDirectory(directory);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      alert('Failed to select directory. Please try again.');
    }
  };

  const handleComplete = async () => {
    if (!workspaceDirectory) {
      alert('Please select a workspace directory');
      return;
    }

    setIsCompleting(true);
    try {
      await onComplete(workspaceDirectory);
    } catch (error) {
      console.error('Failed to complete setup:', error);
      setIsCompleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-full py-12">
      <div className="w-full space-y-8">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-purple-700/20 flex items-center justify-center">
              <Folder className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <h2 className="text-3xl font-semibold text-white">Select Workspace Directory</h2>
          <p className="text-gray-400 text-lg">
            Choose where Griptape Nodes will store your workflows and data
          </p>
        </div>

        {/* Workspace directory selector */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Workspace Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workspaceDirectory}
                readOnly
                className={cn(
                  "flex-1 px-4 py-3 text-sm rounded-md",
                  "bg-gray-900 border border-gray-700",
                  "text-gray-300 font-mono"
                )}
                placeholder="Select a directory"
              />
              <button
                onClick={handleBrowse}
                className={cn(
                  "px-6 py-3 text-sm font-medium rounded-md",
                  "bg-purple-600 hover:bg-purple-500 active:bg-purple-400",
                  "text-white transition-colors"
                )}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-400">
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>This is where your workflow files will be saved</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>You can change this later in Settings</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>The directory will be created if it doesn't exist</span>
            </p>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            <span className="font-semibold">Tip:</span> Choose a location that's easy to find and has enough storage space
            for your workflows. The default location works great for most users.
          </p>
        </div>

        {/* Complete button */}
        <div className="flex justify-center pt-4">
          <button
            onClick={handleComplete}
            disabled={isCompleting || !workspaceDirectory}
            className={cn(
              "px-8 py-4 text-lg font-medium rounded-lg",
              "bg-green-600 hover:bg-green-500 active:bg-green-400",
              "text-white transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isCompleting ? 'Completing Setup...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
