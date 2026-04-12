'use client';

import { cn } from '@/lib/utils';
import {
  Brain,
  CheckCircle2,
  CircleDot,
  RefreshCw,
  Sparkles,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';

export type ThinkingLogKind =
  | 'init'
  | 'thinking'
  | 'done'
  | 'tool'
  | 'error'
  | 'spark'
  | /** 模型思考正文（流式 reasoning_content） */
    'reasoning'
  | 'default';

/**
 * 与服务端 `调用 N 个工具` 固定短句一致。
 * 不能用「同时含调用+工具」判断：长推理里常会同时出现这两个词，会误判为 tool，导致无法显示「第 N 轮思考」。
 */
function isToolStatusLine(log: string): boolean {
  const t = log.trim();
  if (!t) return false;
  if (log.includes('🔧')) return true;
  return /^调用\s*\d+\s*个工具\s*$/.test(t);
}

/** 兼容历史记录里仍带 emoji 的字符串 */
export function classifyThinkingLog(log: string): ThinkingLogKind {
  const t = log.trim();
  if (!t) return 'default';
  if (log.includes('思考完成') || log.includes('✅')) return 'done';
  if (log.includes('ReAct 模式启动') || log.includes('🔄')) return 'init';
  if (log.includes('轮思考中') || log.includes('💭')) return 'thinking';
  if (isToolStatusLine(log)) return 'tool';
  if (log.includes('❌')) return 'error';
  if (log.includes('⚡')) return 'spark';
  /** 非系统提示行视为模型思考过程（与百炼 reasoning_content 一致） */
  return 'reasoning';
}

/**
 * 从开头数到 `index`（含），第几条「模型思考」类日志（用于「第 N 轮思考」）。
 */
export function reasoningRoundIndexInList(logs: string[], index: number): number {
  let n = 0;
  const end = Math.min(index, logs.length - 1);
  for (let i = 0; i <= end; i++) {
    if (classifyThinkingLog(logs[i]) === 'reasoning') n++;
  }
  return n;
}

/** 去掉 emoji，保留可读正文（历史数据兼容） */
export function cleanThinkingLogForDisplay(log: string): string {
  return log
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const iconClass =
  'size-3.5 shrink-0 stroke-[1.75] text-primary';

export function ThinkingLogKindIcon({ kind }: { kind: ThinkingLogKind }) {
  switch (kind) {
    case 'init':
      return (
        <RefreshCw
          className={cn(iconClass, 'opacity-90')}
          aria-hidden
        />
      );
    case 'thinking':
      return (
        <Sparkles
          className={cn(iconClass, 'opacity-75')}
          aria-hidden
        />
      );
    case 'done':
      return (
        <CheckCircle2
          className={cn(iconClass, 'opacity-100')}
          aria-hidden
        />
      );
    case 'tool':
      return (
        <Wrench
          className={cn(iconClass, 'text-muted-foreground opacity-90')}
          aria-hidden
        />
      );
    case 'error':
      return (
        <XCircle
          className={cn(iconClass, 'text-destructive opacity-90')}
          aria-hidden
        />
      );
    case 'spark':
      return (
        <Zap
          className={cn(iconClass, 'text-muted-foreground opacity-90')}
          aria-hidden
        />
      );
    case 'reasoning':
      return (
        <CircleDot
          className={cn(iconClass, 'text-blue-500 dark:text-blue-400')}
          aria-hidden
        />
      );
    default:
      return (
        <CircleDot
          className={cn(iconClass, 'text-muted-foreground opacity-80')}
          aria-hidden
        />
      );
  }
}

/** 思维链标题旁小图标（非 emoji） */
export function ThinkingChainHeaderIcon({ className }: { className?: string }) {
  return (
    <Brain
      className={cn('size-3.5 shrink-0 stroke-[1.75] text-primary', className)}
      aria-hidden
    />
  );
}

/** 与 ThinkingLogKindIcon 语义一致的正文颜色（随主题，低对比为主） */
export function thinkingLogRowTextClass(kind: ThinkingLogKind): string {
  switch (kind) {
    case 'done':
      return 'text-foreground/90';
    case 'error':
      return 'text-destructive';
    case 'reasoning':
      return 'text-foreground/90';
    case 'tool':
    case 'spark':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
}

export function formatThinkingStepMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export type ThinkingStepRingState = 'done' | 'active' | 'pending';

/** 与原先横向进度条相同的语义：每行左侧圆环用 */
export function computeThinkingStepRingState(
  index: number,
  stepCount: number,
  stepDurationsMs: number[] | undefined,
  isLoading: boolean,
): ThinkingStepRingState {
  if (stepCount <= 0) return 'pending';
  const isLast = index === stepCount - 1;
  const d = stepDurationsMs?.[index];
  const hasDuration =
    d !== undefined && d !== null && Number.isFinite(Number(d));
  if (hasDuration) return 'done';
  if (isLoading && isLast) return 'active';
  if (!isLoading) return 'done';
  return 'pending';
}

/** 单步圆环：完成 / 加载中 / 未开始 */
export function ThinkingStepRing({
  state,
  className,
  variant = 'default',
}: {
  state: ThinkingStepRingState;
  className?: string;
  /** 模型思考流：左侧蓝色圆点（与设计稿一致） */
  variant?: 'default' | 'reasoning';
}) {
  if (variant === 'reasoning') {
    return (
      <span
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center',
          className,
        )}
        aria-hidden
      >
        <span
          className={cn(
            'size-2 rounded-full bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)] dark:bg-blue-400',
            state === 'active' && 'motion-safe:animate-pulse',
          )}
        />
      </span>
    );
  }
  if (state === 'done') {
    return (
      <span
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50',
          className,
        )}
        aria-hidden
      >
        <CheckCircle2 className="size-3 text-primary" strokeWidth={2} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center',
          className,
        )}
        aria-hidden
      >
        <span
          className="size-5 rounded-full border-2 border-muted-foreground/25 border-t-primary animate-spin"
          style={{ animationDuration: '0.85s' }}
        />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-block size-5 shrink-0 rounded-full border border-muted-foreground/35 bg-background',
        className,
      )}
      aria-hidden
    />
  );
}
