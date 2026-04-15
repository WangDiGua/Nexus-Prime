'use client';

import dynamic from 'next/dynamic';
import { BarChart3, Copy, RotateCcw, Table2, Wrench } from 'lucide-react';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
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
        正在加载图表...
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

function buildToolSummary(invocations: ToolInvocationView[]): string {
  const pendingCount = invocations.filter((item) => item.state === 'calling').length;
  if (pendingCount > 0) {
    return `本轮已触发 ${invocations.length} 个工具，${pendingCount} 个仍在执行中`;
  }
  return `本轮共执行了 ${invocations.length} 个工具`;
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
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground">
        <Table2 className="size-4" aria-hidden />
        数据表
      </div>
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

function resolvePrimaryDataResult(invocations: ToolInvocationView[]) {
  for (const invocation of invocations) {
    const result = invocation.result;
    if (result?.status !== 'success') {
      continue;
    }
    const visualization = extractVisualizationMessage(result.result);
    const table = extractStructuredTable(result.result);
    if (visualization || table) {
      return {
        visualization,
        table,
        result: result.result,
      };
    }
  }

  return {
    visualization: null,
    table: null,
    result: null,
  };
}

function extractAnswerMode(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    return null;
  }
  return typeof value.metadata.answer_mode === 'string'
    ? value.metadata.answer_mode
    : null;
}

interface ChatMessageProps {
  message: Message;
  onCopyAssistant?: () => void;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
  onOpenToolPanel?: () => void;
  toolPanelActive?: boolean;
}

export default function ChatMessage({
  message,
  onCopyAssistant,
  onRegenerate,
  regenerateDisabled,
  onOpenToolPanel,
  toolPanelActive = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const showAssistantActions = !isUser && (onCopyAssistant || onRegenerate);
  const toolInvocations = message.toolInvocations ?? [];
  const showToolSummary = !isUser && toolInvocations.length > 0 && onOpenToolPanel;
  const primaryDataResult = resolvePrimaryDataResult(toolInvocations);
  const answerMode = extractAnswerMode(primaryDataResult.result);
  const showInlineVisualization = !isUser && Boolean(primaryDataResult.visualization);
  const showInlineTable = !isUser && Boolean(primaryDataResult.table);
  const renderTableFirst = answerMode != null && ['record_lookup', 'roster', 'detail'].includes(answerMode);

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

        {!isUser &&
        (message.content ||
          showAssistantActions ||
          showToolSummary ||
          showInlineVisualization ||
          showInlineTable) ? (
          <div className="max-w-3xl py-1 text-[15px] leading-7 text-foreground">
            {showInlineTable && primaryDataResult.table && renderTableFirst ? (
              <ToolResultTable table={primaryDataResult.table} />
            ) : null}

            {showInlineVisualization ? (
              <div className="mb-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <BarChart3 className="size-4 text-primary" aria-hidden />
                  图表结果
                </div>
                <VisualizationBlock payload={primaryDataResult.result} className="mt-0 border-0 bg-transparent p-0" />
              </div>
            ) : null}

            {showInlineTable && primaryDataResult.table && !renderTableFirst ? (
              <ToolResultTable table={primaryDataResult.table} />
            ) : null}

            {message.content ? (
              <div className={cn('max-w-none text-[15px] leading-relaxed text-foreground', (showInlineVisualization || showInlineTable) && 'mt-3')}>
                <MarkdownContent content={message.content} variant="assistant" />
              </div>
            ) : null}

            {showToolSummary ? (
              <div className={cn('mt-3', message.content && 'pt-2')}>
                <button
                  type="button"
                  onClick={onOpenToolPanel}
                  className={cn(
                    'inline-flex w-full max-w-[26rem] items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                    toolPanelActive
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/70 bg-background/80 hover:bg-muted/40',
                  )}
                >
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <Wrench className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">查看工具执行详情</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {buildToolSummary(toolInvocations)}
                    </p>
                  </div>
                </button>
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
