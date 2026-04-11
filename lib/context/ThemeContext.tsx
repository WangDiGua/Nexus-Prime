'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  THEME_STORAGE_KEY,
  cookieStringForTheme,
  readThemePreferenceFromStorage,
  resolveStoredTheme,
  type ResolvedTheme as LibResolvedTheme,
} from '@/lib/theme-resolve';

export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';
export type ResolvedTheme = LibResolvedTheme;

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

/**
 * 首帧 theme 从 localStorage 同步初始化（与 layout 内联脚本一致），避免刷新时先亮后暗。
 * documentElement 的 class 由内联脚本抢先设置 + 本组件 useEffect 同步。
 */
export function ThemeProvider({ children, defaultTheme = 'SYSTEM' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return readThemePreferenceFromStorage() ?? defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const t = readThemePreferenceFromStorage() ?? defaultTheme;
    return resolveStoredTheme(t);
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'SYSTEM') {
        setResolvedTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveStoredTheme(newTheme));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      document.cookie = cookieStringForTheme(newTheme);
    } catch {
      /* ignore */
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
