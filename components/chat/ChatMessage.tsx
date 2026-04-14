'use client';

import { AlertTriangle, Copy, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { VisualizationBlock } from '@/components/chat/VisualizationBlock';
import {
  extractVisualizationMessage,
  stringifyVisualizationJson,
} from '@/lib/visualization';
import type { ToolInvocationView } from '@/types/chat';

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

function ToolInvocationCard({
  invocation,
}: {
  invocation: NonNullable<Message['toolInvocations']>[number];
}) {
  const result = invocation.result;
  const visualization = result ? extractVisualizationMessage(result.result) : null;

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {invocation.toolName}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {invocation.state === 'calling'
                ? '调用中'
                : result?.status === 'success'
                  ? '成功'
                  : '失败'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {invocation.toolCallId}
          </p>
        </div>
        {invocation.state === 'result' && result?.status === 'error' && result.error ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden />
            错误
          </div>
        ) : null}
      </div>

      {invocation.state === 'calling' && (
        <p className="mt-3 text-sm text-muted-foreground">正在等待工具返回结果...</p>
      )}

      {invocation.state === 'result' && result ? (
        <div className="mt-3 space-y-3">
          {result.status === 'error' ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {result.error || '工具调用失败'}
            </div>
          ) : visualization ? (
            <VisualizationBlock payload={result.result} />
          ) : (
            <div className="rounded-lg border border-border bg-background/80 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                返回内容
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                {formatToolSummary(result.result)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  /** 浠呭姪鎵嬫秷鎭細搴曢儴鎿嶄綔 */
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
  const showAssistantActions =
    !isUser && (onCopyAssistant || onRegenerate);

  const toolInvocations = message.toolInvocations ?? [];
  const showToolInvocations = !isUser && toolInvocations.length > 0;

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-3xl animate-ios-fade-in',
        isUser ? 'flex-row-reverse justify-end' : 'flex-row'
      )}
    >
      <div
        className={cn(
          'flex flex-1 flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {isUser && message.content && (
          <div
            className={cn(
              'max-w-[min(100%,32rem)] rounded-[20px] rounded-tr-[4px] bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm'
            )}
          >
            <div className="max-w-none text-sm leading-relaxed">
              <MarkdownContent content={message.content} variant="user" />
            </div>
          </div>
        )}

        {!isUser && (message.content || showAssistantActions || showToolInvocations) && (
          <div className="max-w-3xl py-1 text-[15px] leading-7 text-foreground">
            {message.content && (
              <div className="max-w-none text-[15px] leading-relaxed text-foreground">
                <MarkdownContent
                  content={message.content}
                  variant="assistant"
                />
              </div>
            )}

            {showToolInvocations && (
              <div className={cn('mt-3 space-y-2', message.content && 'pt-2')}>
                {toolInvocations.map((invocation) => (
                  <ToolInvocationCard
                    key={invocation.toolCallId}
                    invocation={invocation}
                  />
                ))}
              </div>
            )}

            {showAssistantActions && (
              <div
                className={cn(
                  'mt-2 flex flex-wrap items-center gap-1 pt-2',
                  message.content && 'border-t border-border/40',
                )}
              >
                {onCopyAssistant && (
                  <button
                    type="button"
                    onClick={onCopyAssistant}
                    disabled={!message.content?.trim()}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Copy className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    复制
                  </button>
                )}
                {onRegenerate && (
                  <button
                    type="button"
                    disabled={regenerateDisabled}
                    onClick={onRegenerate}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <RotateCcw className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    重新生成
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
