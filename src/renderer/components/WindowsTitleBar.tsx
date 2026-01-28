import { useState, useRef, useEffect } from 'react'
import { cn } from '../utils/utils'
import markLightSrc from '../../assets/griptape_nodes_mark_light.svg'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: boolean
}

interface MenuDropdownProps {
  label: string
  items: MenuItem[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onHover: () => void
  anyMenuOpen: boolean
}

function MenuDropdown({
  label,
  items,
  isOpen,
  onOpenChange,
  onHover,
  anyMenuOpen,
}: MenuDropdownProps) {
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'non-draggable cursor-default focus:outline-none rounded px-3 py-1 text-sm text-gray-300 hover:bg-gray-800',
          isOpen && 'bg-gray-800',
        )}
        onClick={() => onOpenChange(!isOpen)}
        onMouseEnter={() => {
          if (anyMenuOpen) {
            onHover()
          }
        }}
      >
        {label}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 rounded shadow-lg min-w-[200px] bg-gray-800 border border-gray-700 z-50">
          <ul className="px-1 py-1 text-sm">
            {items.map((item, index) =>
              item.separator ? (
                <li key={index} className="border-t border-gray-700 my-1" />
              ) : (
                <li key={index}>
                  <button
                    type="button"
                    className="non-draggable w-full flex items-center justify-between px-3 py-1.5 rounded hover:bg-gray-700 text-left text-gray-300"
                    onClick={() => {
                      item.action?.()
                      onOpenChange(false)
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="text-gray-500 text-xs ml-4">{item.shortcut}</span>
                    )}
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function WindowsTitleBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menubarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menubarRef.current && !menubarRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenu])

  const editActions = {
    undo: () => document.execCommand('undo'),
    redo: () => document.execCommand('redo'),
    cut: () => document.execCommand('cut'),
    copy: () => document.execCommand('copy'),
    paste: () => document.execCommand('paste'),
    selectAll: () => document.execCommand('selectAll'),
  }

  const menus = [
    {
      label: 'File',
      items: [{ label: 'App Settings', action: () => window.menuAPI.appSettings() }],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: editActions.undo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: editActions.redo },
        { separator: true },
        { label: 'Cut', shortcut: 'Ctrl+X', action: editActions.cut },
        { label: 'Copy', shortcut: 'Ctrl+C', action: editActions.copy },
        { label: 'Paste', shortcut: 'Ctrl+V', action: editActions.paste },
        { separator: true },
        { label: 'Select All', shortcut: 'Ctrl+A', action: editActions.selectAll },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Reload', shortcut: 'Ctrl+R', action: () => window.menuAPI.reload() },
        {
          label: 'Force Reload',
          shortcut: 'Ctrl+Shift+R',
          action: () => window.menuAPI.forceReload(),
        },
        {
          label: 'Toggle Developer Tools',
          shortcut: 'Ctrl+Shift+I',
          action: () => window.menuAPI.toggleDevTools(),
        },
        { separator: true },
        { label: 'Actual Size', shortcut: 'Ctrl+0', action: () => window.menuAPI.resetZoom() },
        { label: 'Zoom In', shortcut: 'Ctrl++', action: () => window.menuAPI.zoomIn() },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => window.menuAPI.zoomOut() },
        { separator: true },
        {
          label: 'Toggle Fullscreen',
          shortcut: 'F11',
          action: () => window.menuAPI.toggleFullscreen(),
        },
      ],
    },
    {
      label: 'Window',
      items: [
        { label: 'Minimize', action: () => window.menuAPI.minimize() },
        { label: 'Close', shortcut: 'Alt+F4', action: () => window.menuAPI.close() },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About Griptape Nodes', action: () => window.menuAPI.about() },
        { separator: true },
        { label: 'Check for Updates...', action: () => window.menuAPI.checkForUpdates() },
      ],
    },
  ]

  return (
    <div
      ref={menubarRef}
      id="menubar"
      className="fixed left-0 top-0 w-full h-9 pl-2 flex items-center draggable bg-[#09090b] z-50"
    >
      {/* App Icon */}
      <div className="non-draggable flex items-center px-2">
        <img src={markLightSrc} className="w-4 h-4" alt="" />
      </div>

      {/* Menu Items */}
      {menus.map((menu) => (
        <MenuDropdown
          key={menu.label}
          label={menu.label}
          items={menu.items as MenuItem[]}
          isOpen={openMenu === menu.label}
          onOpenChange={(open) => setOpenMenu(open ? menu.label : null)}
          onHover={() => setOpenMenu(menu.label)}
          anyMenuOpen={openMenu !== null}
        />
      ))}
    </div>
  )
}
