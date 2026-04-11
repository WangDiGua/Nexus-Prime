'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { LogOut, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserSettingsForm } from '@/components/settings/user-settings-form';

export interface UserAccountMenuProps {
  displayName: string;
  onLogout: () => void | Promise<void>;
  variant: 'full' | 'collapsed';
}

/**
 * 侧栏账户入口：浅色面板内嵌完整设置表单，底部为退出登录。
 */
export function UserAccountMenu({
  displayName,
  onLogout,
  variant,
}: UserAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const panelSurface = cn(
    'rounded-2xl border border-gpt-border bg-background text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
    'dark:bg-[#2f2f2f] dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]'
  );

  /** 贴齐面板底边：不设子项圆角与水平 margin，由外层 rounded-2xl + overflow-hidden 裁切 */
  const footerActionClass = cn(
    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
    'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
  );

  const menuPanel = (
    <div
      className={cn(
        panelSurface,
        'flex max-h-[min(85vh,720px)] w-[min(calc(100vw-1.5rem),520px)] flex-col overflow-hidden',
        variant === 'full'
          ? 'absolute bottom-full left-0 z-50 mb-2'
          : 'absolute bottom-0 left-full z-50 ml-2'
      )}
    >
      <div className="shrink-0 border-b border-gpt-border px-4 py-3">
        <p className="truncate text-sm font-semibold text-foreground">{displayName || '用户'}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-none">
        <UserSettingsForm variant="popover" />
      </div>

      <div className="shrink-0 border-t border-gpt-border">
        <button
          type="button"
          className={footerActionClass}
          onClick={() => {
            close();
            void onLogout();
          }}
        >
          <LogOut size={18} className="shrink-0 opacity-90" strokeWidth={2} />
          退出登录
        </button>
      </div>
    </div>
  );

  if (variant === 'collapsed') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="账户与设置"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10"
        >
          <User size={20} strokeWidth={2} />
        </button>
        {open && menuPanel}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors',
          'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
          open && 'bg-black/[0.04] dark:bg-white/[0.05]'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName || '用户'}</p>
        </div>
        <ChevronRight
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
          aria-hidden
        />
      </button>
      {open && menuPanel}
    </div>
  );
}
