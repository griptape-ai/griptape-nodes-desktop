import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../../lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-9 h-9 p-0 flex items-center justify-center",
        "hover:bg-accent hover:text-accent-foreground",
        "rounded-md transition-colors"
      )}
      aria-label="Toggle theme"
    >
      {theme === 'light' && <Sun className="w-5 h-5" />}
      {theme === 'dark' && <Moon className="w-5 h-5" />}
      {theme === 'system' && <Monitor className="w-5 h-5" />}
    </button>
  );
}