import {
  Home,
  Settings,
  User2,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Code,
  Layers
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useEngine } from '../contexts/EngineContext'
import { cn } from '../utils/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
import { getStatusIcon, getStatusTooltip } from '../utils/engineStatusIcons'
import markLightSrc from '@/assets/griptape_nodes_mark_light.svg'
import markDarkSrc from '@/assets/griptape_nodes_mark_dark.svg'

interface SidebarProps {
  className?: string
  selectedPage: string
  onPageChange: (page: string) => void
  hideHeader?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({
  className,
  selectedPage,
  onPageChange,
  hideHeader = false,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const { user, logout } = useAuth()
  const { status } = useEngine()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileButtonRef.current &&
        profileMenuRef.current &&
        !profileButtonRef.current.contains(event.target as Node) &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false)
      }
    }

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileOpen])

  const handleLogout = () => {
    logout()
    setIsProfileOpen(false)
  }

  const handleSettings = () => {
    onPageChange('settings')
    setIsProfileOpen(false)
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'engine', label: 'Engine', icon: Layers, showStatus: true },
    { id: 'editor', label: 'Editor', icon: Code }
  ]

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-border transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo Section - only show if not hidden */}
      {!hideHeader && !isCollapsed && (
        <div className="flex-shrink-0 px-4 py-4 border-b border-border draggable">
          <div className="flex items-center gap-2">
            <img
              src={markLightSrc}
              className="hidden w-8 h-8 dark:block non-draggable"
              alt="Griptape Nodes Logo"
            />
            <img
              src={markDarkSrc}
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
            const Icon = item.icon
            const button = (
              <button
                onClick={() => onPageChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-md transition-colors relative',
                  isCollapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  selectedPage === item.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="text-sm flex-1 text-left">{item.label}</span>
                    {item.showStatus && (
                      <Tooltip delayDuration={500}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">{getStatusIcon(status, 'sm')}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getStatusTooltip(status)}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}
              </button>
            )

            return (
              <li key={item.id}>
                {isCollapsed ? (
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                      {item.showStatus && (
                        <p className="text-xs text-muted-foreground">{getStatusTooltip(status)}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Profile Section with Collapse Button */}
      <div className="flex-shrink-0 border-t border-border p-2">
        <div className="relative">
          {isCollapsed ? (
            <div className="flex flex-col gap-1">
              {/* Profile Button - Collapsed */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    ref={profileButtonRef}
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="w-full flex items-center justify-center hover:bg-sidebar-accent rounded-md px-2 py-1.5 transition-colors"
                  >
                    <User2 className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{user?.name || user?.email || 'User'}</p>
                </TooltipContent>
              </Tooltip>

              {/* Collapse Button - Collapsed */}
              {onToggleCollapse && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggleCollapse}
                      className="w-full flex items-center justify-center hover:bg-sidebar-accent rounded-md px-2 py-1.5 transition-colors"
                    >
                      <ChevronsRight className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Expand sidebar</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {/* Profile Button - Expanded */}
              <button
                ref={profileButtonRef}
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex-1 flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-2 py-1.5 transition-colors"
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

              {/* Collapse Button - Expanded */}
              {onToggleCollapse && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggleCollapse}
                      className="flex items-center justify-center hover:bg-sidebar-accent rounded-md px-2 py-1.5 transition-colors"
                    >
                      <ChevronsLeft className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Collapse sidebar</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Profile Menu Popover */}
          {isProfileOpen && (
            <div
              ref={profileMenuRef}
              className={cn(
                'absolute bottom-full mb-2 bg-popover border border-border rounded-md shadow-lg p-1 z-50',
                isCollapsed ? 'left-0' : 'left-0 right-0'
              )}
            >
              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded transition-colors whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                <span>App Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded transition-colors whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
