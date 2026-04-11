'use client';

import { useTheme } from '@/lib/context/ThemeContext';
import { useEffect } from 'react';

export function ThemeScript() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  return null;
}
