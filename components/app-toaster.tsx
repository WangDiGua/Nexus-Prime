'use client';

import { Toaster } from 'sonner';
import { useTheme } from '@/lib/context/ThemeContext';
import { cn } from '@/lib/utils';

const toastClassNames = {
  toast: cn(
    'font-sans',
    '!rounded-[var(--radius-lg)] !border !p-4 !shadow-md',
    '!border-border/80 !bg-card/95 !text-foreground',
    'backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-md'
  ),
  title: 'text-[0.9375rem] font-medium leading-snug text-foreground',
  description: '!text-muted-foreground text-sm leading-snug',
  content: 'gap-0.5',
  icon: '[&_svg]:size-[18px]',
  closeButton: cn(
    /* 位置见 globals.css 未分层覆盖（Tailwind @layer 会输给 Sonner 注入样式） */
    '!rounded-full !border !border-border/80 !bg-background/90 !text-muted-foreground',
    'hover:!bg-muted hover:!text-foreground'
  ),
  success: cn(
    '!border-primary/25 !bg-primary/[0.08] dark:!border-primary/35 dark:!bg-primary/[0.12]',
    '[&_[data-icon]]:!text-primary'
  ),
  error: cn(
    '!border-destructive/30 !bg-destructive/[0.06] dark:!border-destructive/40',
    '[&_[data-icon]]:!text-destructive'
  ),
  warning: cn(
    '!border-amber-500/30 !bg-amber-500/[0.07] dark:!border-amber-400/25 dark:!bg-amber-400/[0.08]',
    '[&_[data-icon]]:!text-amber-600 dark:[&_[data-icon]]:!text-amber-400'
  ),
  info: cn(
    '!border-primary/20 !bg-primary/[0.05] dark:!border-primary/30 dark:!bg-primary/[0.1]',
    '[&_[data-icon]]:!text-primary'
  ),
  loading: cn('!border-border/80', '[&_.sonner-spinner]:text-primary [&_.sonner-loading-bar]:!bg-primary/40'),
} as const;

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-center"
      closeButton
      duration={4000}
      theme={resolvedTheme}
      toastOptions={{
        classNames: toastClassNames,
      }}
    />
  );
}
