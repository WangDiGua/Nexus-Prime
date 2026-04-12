'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPosition = useCallback(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const width = Math.min(520, vw - margin * 2);
    const gap = 8;

    if (variant === 'full') {
      // 面板下缘在触发器上缘之上 gap（与原 absolute bottom-full + mb-2 一致）
      const bottom = vh - rect.top + gap;
      let left = rect.left;
      left = Math.max(margin, Math.min(left, vw - width - margin));
      setPanelStyle({
        position: 'fixed',
        left,
        width,
        bottom,
        top: 'auto',
        right: 'auto',
        zIndex: 100,
      });
    } else {
      // 与触发器底对齐，默认在右侧；若超出视口则翻到左侧
      let left = rect.right + gap;
      const bottom = vh - rect.bottom;
      if (left + width > vw - margin) {
        left = rect.left - gap - width;
      }
      left = Math.max(margin, Math.min(left, vw - width - margin));
      setPanelStyle({
        position: 'fixed',
        left,
        width,
        bottom,
        top: 'auto',
        right: 'auto',
        zIndex: 100,
      });
    }
  }, [open, variant]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onRelayout = () => updatePanelPosition();
    window.addEventListener('resize', onRelayout);
    window.addEventListener('scroll', onRelayout, true);
    return () => {
      window.removeEventListener('resize', onRelayout);
      window.removeEventListener('scroll', onRelayout, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      // ModelSelect 等通过 Portal 挂到 body，仍属设置面板交互，勿当作「点外部」关窗
      if (
        typeof Element !== 'undefined' &&
        t instanceof Element &&
        t.closest('[data-nexus-floating-overlay]')
      ) {
        return;
      }
      close();
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

  /** 挂到 body，避免侧栏父级 overflow-hidden 横向裁切面板 */
  const menuPanel =
    open &&
    mounted &&
    createPortal(
      <div
        ref={panelRef}
        style={panelStyle}
        className={cn(
          panelSurface,
          'flex max-h-[min(85vh,720px)] flex-col overflow-hidden'
        )}
      >
      <div className="shrink-0 border-b border-gpt-border px-4 py-3">
        <p className="truncate text-sm font-semibold text-foreground">{displayName || '用户'}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3">
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
    </div>,
      document.body
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
        {menuPanel}
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
      {menuPanel}
    </div>
  );
}
