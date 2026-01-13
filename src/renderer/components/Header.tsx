import { Home, Settings, User2, ChevronDown, ChevronUp, LogOut, Code, Layers } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useEngine } from '../contexts/EngineContext'
import { cn } from '../utils/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
import { getStatusIcon, getStatusTooltip } from '../utils/engineStatusIcons'
import { SystemMonitorToolbar } from './SystemMonitorToolbar'
import markLightSrc from '../../assets/griptape_nodes_mark_light.svg'
import markDarkSrc from '../../assets/griptape_nodes_mark_dark.svg'

interface HeaderProps {
  className?: string
  selectedPage: string
  onPageChange: (page: string) => void
  showSystemMonitor?: boolean
}

export function Header({
  className,
  selectedPage,
  onPageChange,
  showSystemMonitor = false
}: HeaderProps) {
  const { user, logout } = useAuth()
  const { status } = useEngine()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [platform, setPlatform] = useState<string>('')

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform)
  }, [])

  const isMac = platform === 'darwin'
  const isWindows = platform === 'win32'

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
    <header
      className={cn(
        'bg-card px-6 py-2 flex items-center gap-4 border-b border-border',
        isMac && 'pl-24 draggable',
        className
      )}
    >
      {/* App Logo - hidden on Windows (shown in title bar) */}
      {!isWindows && (
        <div className="flex items-center gap-2 flex-shrink-0 non-draggable">
          <img src={markLightSrc} className="hidden w-7 h-7 dark:block" alt="Griptape Nodes" />
          <img src={markDarkSrc} className="block w-7 h-7 dark:hidden" alt="Griptape Nodes" />
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 flex items-center gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const button = (
            <button
              onClick={() => onPageChange(item.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                selectedPage === item.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
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
            </button>
          )

          return <div key={item.id}>{button}</div>
        })}
      </nav>

      {/* System Monitor */}
      <SystemMonitorToolbar show={showSystemMonitor} />

      {/* Profile Section */}
      <div className="flex-shrink-0 relative">
        <button
          ref={profileButtonRef}
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-3 py-1.5 transition-colors"
        >
          <User2 className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm truncate max-w-[150px]">
            {user?.name || user?.email || 'User'}
          </span>
          {isProfileOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Profile Menu Dropdown */}
        {isProfileOpen && (
          <div
            ref={profileMenuRef}
            className="absolute top-full right-0 mt-2 bg-popover border border-border rounded-md shadow-lg p-1 z-50 min-w-[160px]"
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
    </header>
  )
}
