'use client';

import dynamic from 'next/dynamic';
import { AlertTriangle, CheckCircle2, Copy, RotateCcw, Wrench } from 'lucide-react';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { summarizeToolInvocation } from '@/lib/agent-workbench';
import { cn } from '@/lib/utils';
import {
  extractVisualizationMessage,
  stringifyVisualizationJson,
} from '@/lib/visualization';
import type { ToolInvocationView } from '@/types/chat';

const VisualizationBlock = dynamic(
  () =>
    import('@/components/chat/VisualizationBlock').then(
      (mod) => mod.VisualizationBlock,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mt-3 rounded-xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
        正在加载图表渲染器...
      </div>
    ),
  },
);

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocationView[];
}

function formatToolSummary(result: unknown): string {
  if (result == null) return '无返回结果';
  if (typeof result === 'string') return result;
  return stringifyVisualizationJson(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractStructuredTable(value: unknown): {
  columns: Array<{ key: string; label: string }>;
  rows: Record<string, unknown>[];
} | null {
  if (!isRecord(value) || !('table' in value) || !isRecord(value.table)) {
    return null;
  }

  const rawColumns = Array.isArray(value.table.columns) ? value.table.columns : [];
  const rows = Array.isArray(value.table.rows)
    ? value.table.rows.filter(isRecord)
    : [];
  if (rawColumns.length === 0 || rows.length === 0) {
    return null;
  }

  const columns = rawColumns
    .map((column) => {
      if (typeof column === 'string') {
        return { key: column, label: column };
      }
      if (isRecord(column) && typeof column.key === 'string') {
        return {
          key: column.key,
          label:
            typeof column.label === 'string' && column.label.trim().length > 0
              ? column.label
              : column.key,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ key: string; label: string }>;

  return columns.length > 0 ? { columns, rows } : null;
}

function renderTableCell(value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return stringifyVisualizationJson(value);
}

function ToolResultTable({
  table,
}: {
  table: { columns: Array<{ key: string; label: string }>; rows: Record<string, unknown>[] };
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/70">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {table.columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border/60">
                {table.columns.map((column) => (
                  <td key={column.key} className="px-3 py-2 align-top text-foreground">
                    {renderTableCell(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolInvocationCard({
  invocation,
}: {
  invocation: NonNullable<Message['toolInvocations']>[number];
}) {
  const delivery = summarizeToolInvocation(invocation);
  const result = invocation.result;
  const visualization = result ? extractVisualizationMessage(result.result) : null;
  const structuredTable = result ? extractStructuredTable(result.result) : null;
  const toneClass =
    delivery.tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
      : delivery.tone === 'error'
        ? 'border-destructive/30 bg-destructive/[0.04]'
        : 'border-border bg-muted/20';

  return (
    <div className={cn('rounded-2xl border p-3', toneClass)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
              <Wrench className="size-4 opacity-75" />
              {delivery.title}
            </span>
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {delivery.statusLabel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground">{delivery.summary}</p>
        </div>
        {delivery.tone === 'success' ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        ) : delivery.tone === 'error' ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : null}
      </div>

      {delivery.highlights.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {delivery.highlights.map((item) => (
            <span
              key={item}
              className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {delivery.nextStep ? (
        <div className="mt-3 rounded-xl bg-background/80 px-3 py-2 text-xs leading-5 text-muted-foreground">
          下一步建议：{delivery.nextStep}
        </div>
      ) : null}

      {result?.status === 'success' && visualization ? (
        <VisualizationBlock payload={result.result} />
      ) : null}

      {result?.status === 'success' && structuredTable ? (
        <ToolResultTable table={structuredTable} />
      ) : null}

      {invocation.state === 'result' ? (
        <details className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground">
            查看原始结果
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
            {formatToolSummary(result?.result ?? delivery.rawResult)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  onCopyAssistant?: () => void;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
}

export default function ChatMessage({
  message,
  onCopyAssistant,
  onRegenerate,
  regenerateDisabled,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const showAssistantActions = !isUser && (onCopyAssistant || onRegenerate);
  const toolInvocations = message.toolInvocations ?? [];
  const showToolInvocations = !isUser && toolInvocations.length > 0;

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-3xl animate-ios-fade-in',
        isUser ? 'flex-row-reverse justify-end' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex flex-1 flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {isUser && message.content ? (
          <div className="max-w-[min(100%,32rem)] rounded-[20px] rounded-tr-[4px] bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
            <div className="max-w-none text-sm leading-relaxed">
              <MarkdownContent content={message.content} variant="user" />
            </div>
          </div>
        ) : null}

        {!isUser && (message.content || showAssistantActions || showToolInvocations) ? (
          <div className="max-w-3xl py-1 text-[15px] leading-7 text-foreground">
            {message.content ? (
              <div className="max-w-none text-[15px] leading-relaxed text-foreground">
                <MarkdownContent content={message.content} variant="assistant" />
              </div>
            ) : null}

            {showToolInvocations ? (
              <div className={cn('mt-3 space-y-2', message.content && 'pt-2')}>
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">关键操作结果</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    下面是本轮回复实际调用过的工具结果。先看摘要，需要时再展开原始数据。
                  </p>
                </div>
                {toolInvocations.map((invocation) => (
                  <ToolInvocationCard
                    key={invocation.toolCallId}
                    invocation={invocation}
                  />
                ))}
              </div>
            ) : null}

            {showAssistantActions ? (
              <div
                className={cn(
                  'mt-2 flex flex-wrap items-center gap-1 pt-2',
                  message.content && 'border-t border-border/40',
                )}
              >
                {onCopyAssistant ? (
                  <button
                    type="button"
                    onClick={onCopyAssistant}
                    disabled={!message.content?.trim()}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Copy className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    复制
                  </button>
                ) : null}
                {onRegenerate ? (
                  <button
                    type="button"
                    disabled={regenerateDisabled}
                    onClick={onRegenerate}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <RotateCcw className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    重新生成
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
