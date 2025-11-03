import { Home, Settings, User2, ChevronDown, ChevronUp, LogOut, Code, Layers } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useEngine } from '../contexts/EngineContext'
import { cn } from '../utils/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
import { getStatusIcon, getStatusTooltip } from '../utils/engineStatusIcons'
import { SystemMonitorToolbar } from './SystemMonitorToolbar'

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
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

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

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'engine', label: 'Engine', icon: Layers, showStatus: true },
    { id: 'editor', label: 'Editor', icon: Code },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <header
      className={cn(
        'bg-card border-b border-border px-6 py-3 flex items-center gap-6 draggable',
        className
      )}
    >
      {/* Navigation Menu */}
      <nav className={cn('flex-1 flex items-center gap-1', isMac && 'ml-20')}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const button = (
            <button
              onClick={() => onPageChange(item.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                selectedPage === item.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
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
          className="flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-3 py-2 transition-colors"
        >
          <User2 className="w-5 h-5 flex-shrink-0" />
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
