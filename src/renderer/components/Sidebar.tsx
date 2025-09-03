import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  Settings, 
  FileText, 
  User2, 
  ChevronDown, 
  ChevronUp, 
  LogOut,
  Code,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useEngine } from '../contexts/EngineContext';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';

interface SidebarProps {
  className?: string;
  selectedPage: string;
  onPageChange: (page: string) => void;
  hideHeader?: boolean;
}

export function Sidebar({ className, selectedPage, onPageChange, hideHeader = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const { status } = useEngine();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileButtonRef.current &&
        profileMenuRef.current &&
        !profileButtonRef.current.contains(event.target as Node) &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
  };

  const getStatusDot = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'ready':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusTooltip = () => {
    switch (status) {
      case 'running':
        return 'Engine is running';
      case 'ready':
        return 'Engine is ready to start';
      case 'error':
        return 'Engine encountered an error';
      case 'not-ready':
        return 'Engine is not initialized';
      default:
        return 'Unknown status';
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'engine', label: 'Engine', icon: Layers, showStatus: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={cn(
      "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-border w-64",
      className
    )}>
      {/* Logo Section - only show if not hidden */}
      {!hideHeader && (
        <div className="flex-shrink-0 px-4 py-4 border-b border-border draggable">
          <div className="flex items-center gap-2">
            <img 
              src="/griptape_nodes_mark_light.svg" 
              className="hidden w-8 h-8 dark:block non-draggable"
              alt="Griptape Nodes Logo"
            />
            <img 
              src="/griptape_nodes_mark_dark.svg" 
              className="block w-8 h-8 dark:hidden non-draggable"
              alt="Griptape Nodes Logo"
            />
            <span className="font-semibold text-lg non-draggable">Griptape Nodes</span>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    selectedPage === item.id && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm flex-1 text-left">{item.label}</span>
                  {item.showStatus && (
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <div className={`w-2 h-2 rounded-full ${getStatusDot()} animate-pulse`}></div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getStatusTooltip()}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile Section */}
      <div className="flex-shrink-0 border-t border-border p-2">
        <div className="relative">
          {/* Profile Button */}
          <button
            ref={profileButtonRef}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-2 py-1.5 transition-colors"
          >
            <User2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm truncate flex-1 text-left">
              {user?.name || user?.email || 'User'}
            </span>
            {isProfileOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Profile Menu Popover */}
          {isProfileOpen && (
            <div 
              ref={profileMenuRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-md shadow-lg p-1 z-50"
            >
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}