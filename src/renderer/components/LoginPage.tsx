import { ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/utils';
import headerLogoSrc from '/griptape_nodes_header_logo.svg';
import animatedNodesSrc from '/animated_nodes.svg';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [browserOpened, setBrowserOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      setBrowserOpened(true);
      await login();
      // The login promise will resolve when auth completes and automatically redirect
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
      setBrowserOpened(false);
    }
  };

  const openExternalLink = (url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-black/50 draggable">
      <div className="w-[90%] h-[90%] max-w-6xl flex flex-col bg-gray-900 rounded-lg border border-blue-500/30 non-draggable">
        {/* Header with logo */}
        <div className="flex items-center justify-center p-6 pb-4 border-b border-gray-700/50">
          <img src={headerLogoSrc} alt="Griptape" className="h-10" />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-12 flex flex-col items-center">
          <div className="w-full max-w-3xl flex flex-col items-center flex-1 justify-center">
            {/* Animation */}
            <div className="mb-12">
              <img src={animatedNodesSrc} alt="Animated Griptape Nodes" className="w-full max-w-lg" />
            </div>
            
            {/* Login content */}
            <div className="w-full max-w-md space-y-8">
              <div className={cn(
                "p-6 rounded-md border",
                browserOpened
                  ? "bg-green-900/20 border-green-700"
                  : "bg-sky-900/20 border-sky-700"
              )}>
                <h3 className="text-white font-medium mb-2 text-lg">
                  {browserOpened ? "Browser Opened" : "Login Required"}
                </h3>
                <p className="text-gray-400 text-sm">
                  {browserOpened
                    ? "Complete the login process in your browser."
                    : "Please log in with your Griptape account to continue"
                  }
                </p>
              </div>

              <button
                onClick={handleLogin}
                className={cn(
                  "w-full flex items-center justify-center gap-3",
                  "bg-sky-700 hover:bg-sky-500 active:bg-sky-300",
                  "text-white font-medium text-base",
                  "px-6 py-4 rounded-md",
                  "transition-colors"
                )}
              >
                <ExternalLink className="w-5 h-5" />
                Log In with Browser
              </button>
              
              {error && (
                <div className="mt-6">
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-md">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center gap-4 p-6 pt-4 border-t border-gray-700/50 text-sm">
          <span className="text-gray-500">Need Help?</span>
          <button 
            onClick={() => openExternalLink('https://docs.griptapenodes.com/en/stable/')}
            className="text-blue-400 hover:underline"
          >
            Documentation
          </button>
          <button 
            onClick={() => openExternalLink('https://docs.griptapenodes.com/en/stable/faq')}
            className="text-blue-400 hover:underline"
          >
            FAQ
          </button>
          <button 
            onClick={() => openExternalLink('https://discord.gg/griptape')}
            className="text-blue-400 hover:underline"
          >
            Discord
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;