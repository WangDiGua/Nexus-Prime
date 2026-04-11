'use client';

import { Copy, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import type { ToolResult } from '@/types/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    state: 'calling' | 'result';
    result?: ToolResult;
  }>;
}

interface ChatMessageProps {
  message: Message;
  /** 仅助手消息：底部操作 */
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
              <MarkdownContent
                content={message.content}
                variant="user"
              />
            </div>
          </div>
        )}

        {!isUser && (message.content || showAssistantActions) && (
          <div className="max-w-3xl py-1 text-[15px] leading-7 text-foreground">
            {message.content && (
              <div className="max-w-none text-[15px] leading-relaxed text-foreground">
                <MarkdownContent
                  content={message.content}
                  variant="assistant"
                />
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
