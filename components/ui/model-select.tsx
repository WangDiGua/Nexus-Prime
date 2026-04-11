'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModelSelectOption {
  value: string;
  label: string;
}

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ModelSelectOption[];
  className?: string;
  id?: string;
  /** 禁用时不可展开、不可切换 */
  disabled?: boolean;
}

export function ModelSelect({
  value,
  onChange,
  options,
  className,
  id,
  disabled = false,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelRect, setPanelRect] = useState({ top: 0, left: 0, minWidth: 0 });

  const selected = options.find((o) => o.value === value) ?? options[0];

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const maxPanelPx = Math.min(window.innerWidth - 16, 28 * 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 8 - maxPanelPx));
    setPanelRect({
      top: rect.bottom + gap,
      left,
      minWidth: rect.width,
    });
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updatePosition);
    ro.observe(el);
    const io = new IntersectionObserver(updatePosition, {
      root: null,
      threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1],
    });
    io.observe(el);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);

    const scrollParents: HTMLElement[] = [];
    let walk: HTMLElement | null = el;
    while (walk) {
      const { overflowY } = getComputedStyle(walk);
      if (/(auto|scroll)/.test(overflowY) && walk.scrollHeight > walk.clientHeight) {
        walk.addEventListener('scroll', updatePosition, { passive: true });
        scrollParents.push(walk);
      }
      walk = walk.parentElement;
    }

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      scrollParents.forEach((p) => p.removeEventListener('scroll', updatePosition));
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
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

  const listbox = open && (
    <div
      ref={panelRef}
      role="listbox"
      aria-activedescendant={value}
      style={{
        position: 'fixed',
        top: panelRect.top,
        left: panelRect.left,
        minWidth: panelRect.minWidth,
        width: 'max-content',
        maxWidth: 'min(calc(100vw - 2rem), 28rem)',
        zIndex: 100,
      }}
      className={cn(
        'rounded-xl border border-gpt-border',
        'bg-background p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
        'dark:bg-[#2f2f2f] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
      )}
    >
      <ul className="max-h-[min(320px,50vh)] overflow-y-auto overflow-x-hidden rounded-lg scrollbar-none">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
                className={cn(
                  'flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                  'rounded-lg',
                  isActive
                    ? 'bg-black/[0.06] font-medium text-foreground dark:bg-white/[0.08]'
                    : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                )}
              >
                <span className="flex flex-1 items-center gap-2 whitespace-nowrap">
                  {isActive && (
                    <Check
                      size={14}
                      className="shrink-0 text-primary"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  )}
                  {!isActive && <span className="w-[14px] shrink-0" aria-hidden />}
                  {opt.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div ref={rootRef} className={cn('relative', className, disabled && 'pointer-events-none opacity-50')}>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-gpt-border',
          'bg-gpt-composer px-3 py-2.5 text-left text-sm text-foreground shadow-sm outline-none transition-colors',
          'hover:bg-[#ececec] focus-visible:ring-2 focus-visible:ring-primary/25',
          'dark:hover:bg-[#3b3b3b]',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span className="min-w-0 flex-1 truncate font-normal">{selected?.label}</span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {typeof document !== 'undefined' &&
        listbox &&
        createPortal(listbox, document.body)}
    </div>
  );
}
