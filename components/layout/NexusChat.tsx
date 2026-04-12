'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ArrowUp,
  PanelLeft,
  Sparkles,
  Square,
} from 'lucide-react';
import {
  ThinkingChainHeaderIcon,
  ThinkingStepRing,
  classifyThinkingLog,
  cleanThinkingLogForDisplay,
  computeThinkingStepRingState,
  formatThinkingStepMs,
  reasoningRoundIndexInList,
  thinkingLogRowTextClass,
} from '@/components/chat/thinking-log-line';
import ChatMessage from '@/components/chat/ChatMessage';
import { ModelSelect } from '@/components/ui/model-select';
import {
  buildChatModelOptions,
  normalizeChatModelId,
} from '@/lib/chat-model-options';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from '@/lib/toast';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { useConversationStore } from '@/hooks/use-conversation-store';
import type { Message as StoredMessage } from '@/hooks/use-conversation-store';
import type { ChatSSEEvent, ToolCall, ToolResult } from '@/types/chat';

export interface NexusChatProps {
  sidebarCollapsed?: boolean;
  onOpenSidebar?: () => void;
}

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
  thinkingLog?: string[];
  /** 与 thinkingLog 等长，每步耗时（毫秒） */
  thinkingStepDurationsMs?: number[];
}

function parseThinkingStepDurations(raw: unknown): number[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  }
  return undefined;
}

/** 将服务端/ store 消息转为 NexusChat 本地 Message */
function mapStoredToLocalMessage(m: StoredMessage): Message {
  return {
    id: m.id,
    role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: m.content,
    thinkingLog: m.thinkingLog || undefined,
    thinkingStepDurationsMs: parseThinkingStepDurations(m.thinkingStepDurationsMs),
  };
}

/** 本地消息 → store 形态，供 localStorage 缓存（createdAt 用占位，避免防抖序列化抖动） */
function localMessagesToStored(
  conversationId: string,
  local: Message[],
): StoredMessage[] {
  return local.map((m, i) => ({
    id: m.id,
    conversationId,
    role:
      m.role === 'assistant'
        ? 'ASSISTANT'
        : m.role === 'system'
          ? 'SYSTEM'
          : 'USER',
    content: m.content,
    toolCalls: null,
    toolResults: null,
    thinkingLog: m.thinkingLog ?? null,
    thinkingStepDurationsMs: m.thinkingStepDurationsMs ?? null,
    tokensUsed: 0,
    latencyMs: 0,
    createdAt: new Date(1000 + i),
  }));
}

function messagesCacheFingerprint(local: Message[]): string {
  return JSON.stringify(
    local.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      thinkingLog: m.thinkingLog,
      thinkingStepDurationsMs: m.thinkingStepDurationsMs,
    })),
  );
}

function ThinkingTrace({
  logs,
  stepDurationsMs,
  isLoading,
}: {
  logs: string[];
  stepDurationsMs?: number[];
  isLoading: boolean;
}) {
  /** 加载结束后可手动展开；加载中强制展开 */
  const [expandedAfterDone, setExpandedAfterDone] = useState(false);
  /** 已完成步骤：默认单行收起，点击展开全文 */
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [liveLastMs, setLiveLastMs] = useState(0);
  const lastStepStartRef = useRef(0);

  useEffect(() => {
    if (!isLoading) {
      const tid = window.setTimeout(() => setExpandedAfterDone(false), 0);
      return () => window.clearTimeout(tid);
    }
  }, [isLoading]);

  useEffect(() => {
    lastStepStartRef.current = Date.now();
  }, [logs.length]);

  useEffect(() => {
    if (!isLoading || logs.length === 0) {
      const clearId = window.setTimeout(() => setLiveLastMs(0), 0);
      return () => window.clearTimeout(clearId);
    }
    const update = () => {
      setLiveLastMs(Math.max(0, Date.now() - lastStepStartRef.current));
    };
    const t0 = window.setTimeout(update, 0);
    const id = window.setInterval(update, 120);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [isLoading, logs.length]);

  const showDetail = isLoading || expandedAfterDone;

  const completedLogs =
    isLoading && logs.length > 1
      ? logs.slice(0, -1)
      : !isLoading
        ? logs
        : [];

  return (
    <div className="max-w-3xl mx-auto animate-ios-fade-in">
      <button
        type="button"
        onClick={() => {
          if (!isLoading) setExpandedAfterDone((e) => !e);
        }}
        className="flex w-full max-w-3xl items-center justify-between gap-2 rounded-lg bg-primary/5 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10"
        aria-expanded={showDetail}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <ThinkingChainHeaderIcon />
          已思考
        </span>
        <svg
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            showDetail && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0',
          showDetail ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
        aria-hidden={!showDetail}
      >
        <div
          className={cn(
            'min-h-0 overflow-hidden',
            !showDetail && 'pointer-events-none',
          )}
        >
          <div className="mt-2 space-y-2 rounded-xl border border-gpt-border bg-[#f4f4f4] p-3 dark:bg-[#2f2f2f]">
          {logs.length === 0 && isLoading && (
            <div className="rounded-lg border border-border bg-background px-3 py-2.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                当前思考
              </p>
              <div className="flex items-stretch gap-2.5 font-mono text-xs text-muted-foreground">
                <div className="flex w-5 shrink-0 flex-col items-center self-stretch">
                  <ThinkingStepRing
                    state="active"
                    className="mt-0.5 shrink-0"
                  />
                </div>
                <span className="min-w-0 flex-1 leading-relaxed">
                  正在发起请求，等待模型返回思考步骤…
                </span>
              </div>
            </div>
          )}

          {completedLogs.map((log, origIdx) => {
            const kind = classifyThinkingLog(log);
            const text = cleanThinkingLogForDisplay(log);
            const d = stepDurationsMs?.[origIdx];
            const hasSavedDuration =
              d !== undefined && d !== null && Number.isFinite(Number(d));
            const durationMs =
              hasSavedDuration
                ? Number(d)
                : isLoading && origIdx === logs.length - 1
                  ? liveLastMs
                  : undefined;
            const ringState = computeThinkingStepRingState(
              origIdx,
              logs.length,
              stepDurationsMs,
              isLoading,
            );
            const showConnectorBelow =
              origIdx < completedLogs.length - 1 ||
              (isLoading &&
                logs.length > 0 &&
                origIdx === completedLogs.length - 1);
            const stepDone = Boolean(hasSavedDuration);
            const stepExpanded = expandedSteps[origIdx] === true;
            const showCollapsedBody = stepDone && !stepExpanded;
            const isReasoning = kind === 'reasoning';
            const reasoningRound = isReasoning
              ? reasoningRoundIndexInList(completedLogs, origIdx)
              : 0;
            const showCollapsedReasoningTitle =
              showCollapsedBody && isReasoning && stepDone;
            return (
              <div
                key={origIdx}
                className={cn(
                  'flex items-start gap-2.5 rounded px-2 py-1 text-xs',
                  kind === 'reasoning' ? 'font-sans' : 'font-mono',
                  thinkingLogRowTextClass(kind),
                  stepDone &&
                    'cursor-pointer rounded-md transition-colors hover:bg-muted/45',
                )}
                role={stepDone ? 'button' : undefined}
                tabIndex={stepDone ? 0 : undefined}
                aria-expanded={stepDone ? stepExpanded : undefined}
                onClick={
                  stepDone
                    ? () =>
                        setExpandedSteps((prev) => ({
                          ...prev,
                          [origIdx]: !prev[origIdx],
                        }))
                    : undefined
                }
                onKeyDown={
                  stepDone
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedSteps((prev) => ({
                            ...prev,
                            [origIdx]: !prev[origIdx],
                          }));
                        }
                      }
                    : undefined
                }
              >
                <div className="flex w-5 shrink-0 flex-col items-center self-stretch">
                  <div className="flex h-5 w-full shrink-0 items-center justify-center">
                    <ThinkingStepRing
                      state={ringState}
                      variant={kind === 'reasoning' ? 'reasoning' : 'default'}
                      className="shrink-0"
                    />
                  </div>
                  {showConnectorBelow && (
                    <div
                      className="mb-[-0.5rem] mt-0 min-h-[0.5rem] w-px flex-1 bg-border/80"
                      aria-hidden
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'min-w-0 flex-1 break-words leading-5',
                    showCollapsedBody && !showCollapsedReasoningTitle && 'line-clamp-1',
                  )}
                  title={showCollapsedReasoningTitle ? text : undefined}
                >
                  {showCollapsedReasoningTitle
                    ? `第 ${reasoningRound} 轮思考`
                    : text}
                </span>
                {durationMs !== undefined && (
                  <span className="ml-1 shrink-0 self-start pt-0 tabular-nums leading-5 text-muted-foreground">
                    {formatThinkingStepMs(durationMs)}
                  </span>
                )}
              </div>
            );
          })}

          {isLoading && logs.length > 0 && (() => {
            const cur = logs[logs.length - 1]!;
            const curIdx = logs.length - 1;
            const kind = classifyThinkingLog(cur);
            const text = cleanThinkingLogForDisplay(cur);
            const d = stepDurationsMs?.[curIdx];
            const hasSavedDuration =
              d !== undefined && d !== null && Number.isFinite(Number(d));
            const durationMs = hasSavedDuration ? Number(d) : liveLastMs;
            return (
              <div
                className={cn(
                  'rounded-lg border border-primary/20 bg-background px-3 py-2.5 shadow-sm',
                  thinkingLogRowTextClass(kind),
                )}
              >
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  当前思考
                </p>
                <div
                  className={cn(
                    'flex items-start gap-2.5 text-xs',
                    kind === 'reasoning' ? 'font-sans' : 'font-mono',
                  )}
                >
                  <div
                    className="flex h-5 w-9 shrink-0 items-center justify-center"
                    aria-hidden
                  >
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45" />
                    </div>
                  </div>
                  <span className="min-w-0 flex-1 break-words leading-5">
                    {text}
                  </span>
                  {durationMs !== undefined && (
                    <span className="ml-1 shrink-0 self-start tabular-nums leading-5 text-muted-foreground">
                      {formatThinkingStepMs(durationMs)}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 未开思考模式时：首包前在左侧显示三点，避免空白像卡死 */
function AssistantStreamDots() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl animate-ios-fade-in justify-start"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-1 py-2 pl-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45" />
      </div>
    </div>
  );
}

/** 会话区与输入条骨架：避免「恢复会话」与「请登录」文案同时出现 */
function ChatShellSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="加载中">
      <div className="min-h-0 flex-1 space-y-6 overflow-hidden px-3 py-4 sm:px-4">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="flex justify-end">
            <div className="h-9 w-[min(66%,18rem)] rounded-2xl bg-muted/50 motion-safe:animate-pulse" />
          </div>
          <div className="flex justify-start">
            <div className="h-24 w-[min(78%,22rem)] rounded-2xl bg-muted/40 motion-safe:animate-pulse" />
          </div>
          <div className="flex justify-end">
            <div className="h-9 w-[min(55%,14rem)] rounded-2xl bg-muted/50 motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
      <div className="shrink-0 px-3 pt-2 sm:px-4 pb-safe-composer">
        <div className="relative mx-auto w-full max-w-3xl">
          <div className="flex h-[52px] items-center gap-2 rounded-[1.75rem] border border-gpt-border/80 bg-gpt-composer px-2 py-2 pl-2.5">
            <div className="h-8 w-9 shrink-0 rounded-full bg-muted/60 motion-safe:animate-pulse" />
            <div className="h-8 min-w-0 flex-1 rounded-xl bg-muted/60 motion-safe:animate-pulse" />
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted/60 motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NexusChat({
  sidebarCollapsed = false,
  onOpenSidebar,
}: NexusChatProps) {
  const { isAuthenticated, isReady, openLogin } = useAuth();
  const canChat = isReady && isAuthenticated;
  const { addPacket, updateContext, config, updateConfig } = useRegistryStore();
  const {
    activeConversationId,
    messages: storedMessages,
    setMessages: setStoredMessages,
    setActiveConversation,
    bumpConversationList,
  } = useConversationStore();
  
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  /**
   * 必须与 SSR 首屏一致：不可在 useState 初始值里读 hasHydrated()，
   * 否则客户端首帧可能已为 true，服务端始终为 false，触发 hydration mismatch。
   */
  const [persistHydrated, setPersistHydrated] = useState(false);
  /** 正在从服务端拉取当前会话消息（刷新后） */
  const [messagesRestoring, setMessagesRestoring] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (useConversationStore.persist.hasHydrated()) {
      setPersistHydrated(true);
    }
    const unsub = useConversationStore.persist.onFinishHydration(() => {
      setPersistHydrated(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.defaultModel) updateConfig({ model: s.defaultModel });
      })
      .catch(() => {});
  }, [updateConfig]);

  const handleModelChange = async (value: string) => {
    updateConfig({ model: value });
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultModel: value }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '默认模型同步失败');
      }
    } catch {
      toast.error('默认模型同步失败');
    }
  };

  const chatModelOptions = useMemo(
    () => buildChatModelOptions(config.model),
    [config.model]
  );

  const resolvedModelValue = useMemo(() => {
    const raw = config.model;
    const normalized = normalizeChatModelId(raw) ?? raw;
    const known = chatModelOptions.some((o) => o.value === normalized);
    return known ? normalized! : chatModelOptions[0]?.value ?? '';
  }, [chatModelOptions, config.model]);

  /** 当前这次请求对应的助手消息 id（首包 SSE 前已插入占位，避免误用「上一条助手」） */
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(
    null,
  );

  /** 是否向百炼请求思考链（reasoning）；持久化到 localStorage */
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem('nexus-prime:thinking-mode') === 'true') {
        setThinkingModeEnabled(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        'nexus-prime:thinking-mode',
        thinkingModeEnabled ? 'true' : 'false'
      );
    } catch {
      /* ignore */
    }
  }, [thinkingModeEnabled]);

  const prevActiveConversationId = useRef<string | null>(activeConversationId);
  /** 仅用于恢复拉取：首帧为 null，便于在「刷新 / 首次进入带 id」时与当前 id 比较为已变化，从而必定请求服务端 */
  const restorePrevConversationIdRef = useRef<string | null>(null);
  const localMessagesRef = useRef<Message[]>([]);
  localMessagesRef.current = localMessages;

  /** 服务端/持久化 store 更新时同步到本地；与本地指纹一致则跳过，避免与「本地→store 防抖」互相打架 */
  useEffect(() => {
    if (storedMessages.length === 0) return;
    const fromStored = storedMessages.map(mapStoredToLocalMessage);
    if (
      messagesCacheFingerprint(fromStored) ===
      messagesCacheFingerprint(localMessagesRef.current)
    ) {
      return;
    }
    setLocalMessages(fromStored);
  }, [storedMessages]);

  const lastPersistedFingerprintRef = useRef<string>('');

  /** 本地对话 → zustand persist（localStorage），实现浏览器侧缓存，供刷新后先展示再与 DB 对齐 */
  useEffect(() => {
    if (!activeConversationId || !persistHydrated) return;

    const t = window.setTimeout(() => {
      const fp = messagesCacheFingerprint(localMessages);
      if (fp === lastPersistedFingerprintRef.current) return;
      lastPersistedFingerprintRef.current = fp;
      setStoredMessages(
        localMessagesToStored(activeConversationId, localMessages),
      );
    }, 350);
    return () => window.clearTimeout(t);
  }, [localMessages, activeConversationId, persistHydrated, setStoredMessages]);

  /**
   * 类缓存策略：persist 重hydrate 后若有与当前会话 id 一致的本地 messages，先直接展示（浏览器一级缓存），
   * 同时后台请求数据库并以服务端结果为准覆盖；无本地缓存时才显示「恢复中」。
   * 同一会话且正在流式时不拉取，避免覆盖乐观 UI。
   * 切勿将 isLoading 列入依赖：流式结束 isLoading→false 会再次跑本 effect 并请求 API，
   * 若请求早于助手消息落库或与 DB 竞态，会用不完整列表覆盖 localMessages，导致「回复后内容消失」。
   */
  useEffect(() => {
    if (!canChat || !activeConversationId) {
      restorePrevConversationIdRef.current = activeConversationId;
      return;
    }
    if (!persistHydrated) {
      return;
    }

    const prev = restorePrevConversationIdRef.current;
    const conversationChanged = prev !== activeConversationId;

    if (!conversationChanged && isLoading) {
      return;
    }

    /**
     * 首条消息会先 setIsLoading(true)，再 POST 创建会话并 setActiveConversation(null→id)。
     * 此时若按「会话切换」清空并拉取，会抹掉乐观插入的用户/助手占位。
     */
    if (conversationChanged && prev === null && isLoading) {
      restorePrevConversationIdRef.current = activeConversationId;
      return;
    }

    restorePrevConversationIdRef.current = activeConversationId;

    /** 仅会话 A→B 切换时清空；刷新(null→id) 保留已重hydrate 的本地缓存 */
    const switchedConversation =
      conversationChanged &&
      prev !== null &&
      prev !== activeConversationId;
    if (switchedConversation) {
      setStoredMessages([]);
      setLocalMessages([]);
    }

    const msgs = useConversationStore.getState().messages;
    const hasBrowserCache =
      msgs.length > 0 &&
      msgs.every((m) => m.conversationId === activeConversationId);

    let cancelled = false;
    if (!hasBrowserCache) {
      setMessagesRestoring(true);
    }
    void (async () => {
      try {
        const response = await fetch(
          `/api/conversations/${activeConversationId}?messages=true`
        );
        if (!response.ok || cancelled) return;
        const conversation = await response.json();
        if (cancelled) return;

        const raw = Array.isArray(conversation.messages)
          ? conversation.messages
          : [];
        const mapped: StoredMessage[] = raw.map((m: Record<string, unknown>) => ({
          id: m.id as string,
          conversationId: (m.conversationId as string) ?? activeConversationId,
          role: m.role as 'USER' | 'ASSISTANT' | 'SYSTEM',
          content: m.content as string,
          toolCalls: (m.toolCalls as Record<string, unknown> | null) ?? null,
          toolResults:
            (m.toolResults as Record<string, unknown> | null) ?? null,
          thinkingLog: m.thinkingLog
            ? Object.values(m.thinkingLog as Record<string, unknown>)
            : null,
          thinkingStepDurationsMs: parseThinkingStepDurations(
            m.thinkingStepDurationsMs,
          ),
          tokensUsed: (m.tokensUsed as number) ?? 0,
          latencyMs: (m.latencyMs as number) ?? 0,
          createdAt: new Date(m.createdAt as string),
        }));

        setStoredMessages(mapped);
        setLocalMessages(mapped.map(mapStoredToLocalMessage));
      } catch (e) {
        console.error('[NexusChat] restore conversation failed', e);
      } finally {
        if (!cancelled) {
          setMessagesRestoring(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setMessagesRestoring(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isLoading 不列入，避免流式结束后重复拉 API 覆盖界面
  }, [canChat, activeConversationId, setStoredMessages, persistHydrated]);

  /** 仅在「新建会话」从有 id → null 时清空本地消息 */
  useEffect(() => {
    const prev = prevActiveConversationId.current;
    if (prev !== null && activeConversationId === null) {
      setLocalMessages([]);
    }
    prevActiveConversationId.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, isLoading]);

  const saveMessageToDB = useCallback(async (
    role: 'USER' | 'ASSISTANT',
    content: string,
    conversationId: string,
    thinkingLog?: string[],
    thinkingStepDurationsMs?: number[],
    tokensUsed?: number,
    /** 当前轮次使用的模型 id（与头部 ModelSelect / 服务端 chat 一致） */
    model?: string
  ) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          thinkingLog: thinkingLog ? thinkingLog.reduce((acc, log, i) => ({ ...acc, [i]: log }), {}) : null,
          thinkingStepDurationsMs:
            thinkingStepDurationsMs && thinkingStepDurationsMs.length > 0
              ? thinkingStepDurationsMs
              : null,
          tokensUsed: tokensUsed || 0,
          ...(model ? { model } : {}),
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(
          'Failed to save message:',
          response.status,
          errText.slice(0, 200)
        );
      }
      return response.ok;
    } catch (error) {
      console.error('Failed to save message:', error);
      return false;
    }
  }, []);

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      setStreamingAssistantId(null);
    }
  }, [abortController]);

  const runAssistantStream = useCallback(
    async (params: {
      assistantMessageId: string;
      apiMessages: { role: string; content: string }[];
      conversationId: string | null;
      controller: AbortController;
      enableThinking: boolean;
    }) => {
      const {
        assistantMessageId,
        apiMessages,
        conversationId: currentConversationId,
        controller,
        enableThinking,
      } = params;

      /** 未开启「思考」时不展示/不落库 ReAct 思维链（仍走工具调用与正文流） */
      const collectThinkingUi = enableThinking;

      /** 本轮请求对应的模型（与头部选择器一致，供落库） */
      const modelForThisTurn = resolvedModelValue;

      let currentContent = '';
      let currentToolInvocations: Message['toolInvocations'] = [];
      let currentThinkingLog: string[] = [];
      let currentThinkingDurationsMs: number[] = [];
      let thinkingStepStartedAt = Date.now();
      /** 是否处于同一轮「模型思考」流式片段中（reasoning_delta） */
      let reasoningDeltaOpen = false;

      const finalizeLastThinkingStep = () => {
        const now = Date.now();
        if (currentThinkingLog.length > 0) {
          const lastIdx = currentThinkingLog.length - 1;
          if (currentThinkingDurationsMs[lastIdx] === undefined) {
            currentThinkingDurationsMs[lastIdx] = Math.max(0, now - thinkingStepStartedAt);
          }
        }
      };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: currentConversationId,
            messages: apiMessages,
            enableThinking,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let sseLineBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          sseLineBuffer += decoder.decode(value ?? new Uint8Array(), {
            stream: !done,
          });
          const lines = sseLineBuffer.split('\n');
          sseLineBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as ChatSSEEvent;

                switch (event.type) {
                  case 'reasoning_delta': {
                    if (!collectThinkingUi) break;
                    const now = Date.now();
                    if (!reasoningDeltaOpen) {
                      reasoningDeltaOpen = true;
                      if (currentThinkingLog.length > 0) {
                        const prevIdx = currentThinkingLog.length - 1;
                        currentThinkingDurationsMs[prevIdx] = now - thinkingStepStartedAt;
                      }
                      currentThinkingLog.push(event.content);
                      thinkingStepStartedAt = now;
                    } else {
                      const lastIdx = currentThinkingLog.length - 1;
                      if (lastIdx >= 0) {
                        currentThinkingLog[lastIdx] =
                          (currentThinkingLog[lastIdx] || '') + event.content;
                      }
                    }
                    setLocalMessages(prev => {
                      const existing = prev.find(m => m.id === assistantMessageId);
                      if (existing) {
                        return prev.map(m =>
                          m.id === assistantMessageId
                            ? {
                                ...m,
                                content: currentContent,
                                toolInvocations: currentToolInvocations,
                                thinkingLog: [...currentThinkingLog],
                                thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                              }
                            : m
                        );
                      }
                      return [...prev, {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: currentContent,
                        toolInvocations: currentToolInvocations,
                        thinkingLog: [...currentThinkingLog],
                        thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                      }];
                    });
                    break;
                  }

                  case 'thinking': {
                    if (!collectThinkingUi) break;
                    reasoningDeltaOpen = false;
                    const now = Date.now();
                    if (currentThinkingLog.length > 0) {
                      const prevIdx = currentThinkingLog.length - 1;
                      currentThinkingDurationsMs[prevIdx] = now - thinkingStepStartedAt;
                    }
                    currentThinkingLog.push(event.content);
                    thinkingStepStartedAt = now;
                    setLocalMessages(prev => {
                      const existing = prev.find(m => m.id === assistantMessageId);
                      if (existing) {
                        return prev.map(m =>
                          m.id === assistantMessageId
                            ? {
                                ...m,
                                content: currentContent,
                                toolInvocations: currentToolInvocations,
                                thinkingLog: [...currentThinkingLog],
                                thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                              }
                            : m
                        );
                      }
                      return [...prev, {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: currentContent,
                        toolInvocations: currentToolInvocations,
                        thinkingLog: [...currentThinkingLog],
                        thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                      }];
                    });
                    break;
                  }

                  case 'content': {
                    if (reasoningDeltaOpen) {
                      reasoningDeltaOpen = false;
                      const now = Date.now();
                      if (currentThinkingLog.length > 0) {
                        const prevIdx = currentThinkingLog.length - 1;
                        currentThinkingDurationsMs[prevIdx] = now - thinkingStepStartedAt;
                      }
                      thinkingStepStartedAt = now;
                    }
                    currentContent += event.content;
                    setLocalMessages(prev => {
                      const existing = prev.find(m => m.id === assistantMessageId);
                      if (existing) {
                        return prev.map(m =>
                          m.id === assistantMessageId
                            ? {
                                ...m,
                                content: currentContent,
                                toolInvocations: currentToolInvocations,
                                thinkingLog: [...currentThinkingLog],
                                thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                              }
                            : m
                        );
                      }
                      return [...prev, {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: currentContent,
                        toolInvocations: currentToolInvocations,
                        thinkingLog: [...currentThinkingLog],
                        thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                      }];
                    });
                    break;
                  }

                  case 'tool_call': {
                    if (reasoningDeltaOpen) {
                      reasoningDeltaOpen = false;
                      const now = Date.now();
                      if (currentThinkingLog.length > 0) {
                        const prevIdx = currentThinkingLog.length - 1;
                        currentThinkingDurationsMs[prevIdx] = now - thinkingStepStartedAt;
                      }
                      thinkingStepStartedAt = now;
                    }
                    const toolCall = event.toolCall;
                    currentToolInvocations.push({
                      toolCallId: toolCall.id,
                      toolName: toolCall.name,
                      args: toolCall.args,
                      state: 'calling',
                    });

                    addPacket({
                      id: `call_${toolCall.id}`,
                      type: '工具',
                      method: 'POST',
                      endpoint: `/invoke/${toolCall.name}`,
                      status: 0,
                      time: '调用中...',
                      payload: toolCall.args
                    });

                    setLocalMessages(prev => {
                      const existing = prev.find(m => m.id === assistantMessageId);
                      if (existing) {
                        return prev.map(m =>
                          m.id === assistantMessageId
                            ? {
                                ...m,
                                content: currentContent,
                                toolInvocations: [...currentToolInvocations],
                                thinkingLog: [...currentThinkingLog],
                                thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                              }
                            : m
                        );
                      }
                      return [...prev, {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: currentContent,
                        toolInvocations: [...currentToolInvocations],
                        thinkingLog: [...currentThinkingLog],
                        thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                      }];
                    });
                    break;
                  }

                  case 'tool_result': {
                    const result = event.result;
                    const invocationIndex = currentToolInvocations.findIndex(
                      ti => ti.toolCallId === result.toolCallId
                    );

                    if (invocationIndex !== -1) {
                      currentToolInvocations[invocationIndex] = {
                        ...currentToolInvocations[invocationIndex],
                        state: 'result',
                        result,
                      };

                      addPacket({
                        id: `result_${result.toolCallId}`,
                        type: '工具',
                        method: 'POST',
                        endpoint: `/invoke/${result.toolName}`,
                        status: result.status === 'success' ? 200 : 500,
                        time: `${result.latency || 0}ms`,
                        payload: result.args,
                        response: result.result,
                      });

                      setLocalMessages(prev => prev.map(m =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              toolInvocations: [...currentToolInvocations],
                              thinkingLog: [...currentThinkingLog],
                              thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                            }
                          : m
                      ));
                    }
                    break;
                  }

                  case 'error':
                    setLocalMessages(prev => [...prev, {
                      id: Math.random().toString(36).substring(7),
                      role: 'assistant',
                      content: `错误: ${event.error}`,
                    }]);
                    break;

                  case 'done':
                    finalizeLastThinkingStep();
                    updateContext(
                      Math.floor(Math.random() * 500) + 1000,
                      { last_response: "Success", timestamp: new Date().toISOString() }
                    );
                    break;
                }
              } catch {
                // Ignore parse errors for individual events
              }
            }
          }
          if (done) break;
        }

        if (sseLineBuffer.startsWith('data: ')) {
          try {
            const event = JSON.parse(sseLineBuffer.slice(6)) as ChatSSEEvent;
            if (
              collectThinkingUi &&
              event.type === 'reasoning_delta' &&
              event.content
            ) {
              const now = Date.now();
              if (!reasoningDeltaOpen) {
                reasoningDeltaOpen = true;
                if (currentThinkingLog.length > 0) {
                  const prevIdx = currentThinkingLog.length - 1;
                  currentThinkingDurationsMs[prevIdx] = now - thinkingStepStartedAt;
                }
                currentThinkingLog.push(event.content);
                thinkingStepStartedAt = now;
              } else {
                const lastIdx = currentThinkingLog.length - 1;
                if (lastIdx >= 0) {
                  currentThinkingLog[lastIdx] =
                    (currentThinkingLog[lastIdx] || '') + event.content;
                }
              }
              setLocalMessages((prev) => {
                const existing = prev.find((m) => m.id === assistantMessageId);
                if (existing) {
                  return prev.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          content: currentContent,
                          toolInvocations: currentToolInvocations,
                          thinkingLog: [...currentThinkingLog],
                          thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                        }
                      : m
                  );
                }
                return [
                  ...prev,
                  {
                    id: assistantMessageId,
                    role: 'assistant' as const,
                    content: currentContent,
                    toolInvocations: currentToolInvocations,
                    thinkingLog: [...currentThinkingLog],
                    thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                  },
                ];
              });
            } else if (event.type === 'content' && event.content) {
              if (reasoningDeltaOpen) {
                reasoningDeltaOpen = false;
                const now = Date.now();
                if (currentThinkingLog.length > 0) {
                  const prevIdx = currentThinkingLog.length - 1;
                  currentThinkingDurationsMs[prevIdx] = now - thinkingStepStartedAt;
                }
                thinkingStepStartedAt = now;
              }
              currentContent += event.content;
              setLocalMessages((prev) => {
                const existing = prev.find((m) => m.id === assistantMessageId);
                if (existing) {
                  return prev.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          content: currentContent,
                          toolInvocations: currentToolInvocations,
                          thinkingLog: [...currentThinkingLog],
                          thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                        }
                      : m
                  );
                }
                return [
                  ...prev,
                  {
                    id: assistantMessageId,
                    role: 'assistant' as const,
                    content: currentContent,
                    toolInvocations: currentToolInvocations,
                    thinkingLog: [...currentThinkingLog],
                    thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                  },
                ];
              });
            }
          } catch {
            // trailing fragment incomplete
          }
        }

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Chat API Error:', error);
        toast.error('对话请求失败，请稍后重试');
        const detail = error instanceof Error ? error.message : String(error);
        setLocalMessages(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: `请求出错：${detail}\n\n请确认服务端已配置 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL，并确保 LantuConnect-Backend 服务正在运行。`
        }]);
      } finally {
        finalizeLastThinkingStep();
        if (
          currentConversationId &&
          (currentContent.trim().length > 0 ||
            currentToolInvocations.length > 0)
        ) {
          const ok = await saveMessageToDB(
            'ASSISTANT',
            currentContent,
            currentConversationId,
            currentThinkingLog,
            currentThinkingDurationsMs,
            undefined,
            modelForThisTurn,
          );
          if (!ok) {
            console.warn(
              '[NexusChat] Assistant reply was not persisted to the server'
            );
          }
        }
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  thinkingStepDurationsMs: [...currentThinkingDurationsMs],
                }
              : m
          ),
        );
        setIsLoading(false);
        setStreamingAssistantId(null);
        setAbortController(null);
        if (currentConversationId) {
          bumpConversationList();
        }
      }
    },
    [
      saveMessageToDB,
      addPacket,
      updateContext,
      toast,
      resolvedModelValue,
      bumpConversationList,
    ],
  );

  const handleCopyAssistant = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制');
    } catch {
      toast.error('复制失败');
    }
  }, []);

  const handleRegenerateAssistant = useCallback(
    async (assistantMessageId: string) => {
      if (!canChat) {
        openLogin();
        return;
      }
      if (isLoading) return;

      const idx = localMessages.findIndex((m) => m.id === assistantMessageId);
      if (idx <= 0) return;
      const target = localMessages[idx];
      if (!target || target.role !== 'assistant') return;
      if (localMessages[idx - 1]?.role !== 'user') {
        toast.error('无法重新生成：未找到对应的用户消息');
        return;
      }

      const base = localMessages.slice(0, idx);
      const apiMessages = base.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const newAssistantId = Math.random().toString(36).substring(7);

      setStreamingAssistantId(newAssistantId);
      setLocalMessages([
        ...base,
        {
          id: newAssistantId,
          role: 'assistant',
          content: '',
          thinkingLog: [],
          thinkingStepDurationsMs: [],
        },
      ]);
      setIsLoading(true);
      const controller = new AbortController();
      setAbortController(controller);

      await runAssistantStream({
        assistantMessageId: newAssistantId,
        apiMessages,
        conversationId: activeConversationId,
        controller,
        enableThinking: thinkingModeEnabled,
      });
    },
    [
      canChat,
      openLogin,
      isLoading,
      localMessages,
      activeConversationId,
      runAssistantStream,
      thinkingModeEnabled,
    ],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canChat) {
      openLogin();
      return;
    }
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: input,
    };
    const assistantMessageId = Math.random().toString(36).substring(7);
    setStreamingAssistantId(assistantMessageId);

    setLocalMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        thinkingLog: [],
        thinkingStepDurationsMs: [],
      },
    ]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    let currentConversationId = activeConversationId;

    if (!currentConversationId) {
      try {
        const createResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (createResponse.ok) {
          const conversation = await createResponse.json();
          currentConversationId = conversation.id;
          setActiveConversation(currentConversationId);
          bumpConversationList();
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    }

    if (currentConversationId) {
      await saveMessageToDB(
        'USER',
        userMessage.content,
        currentConversationId,
        undefined,
        undefined,
        undefined,
        resolvedModelValue,
      );
    }
    await runAssistantStream({
      assistantMessageId,
      apiMessages: [
        ...localMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: userMessage.content },
      ],
      conversationId: currentConversationId,
      controller,
      enableThinking: thinkingModeEnabled,
    });
  };

  /**
   * 首包 SSE 前已插入助手占位 + 思维链占位；仅当没有当前流式助手 id 时兜底显示底部「正在思考」。
   */
  const showTypingIndicator =
    isLoading &&
    !localMessages.some(
      (m) => m.role === 'assistant' && m.id === streamingAssistantId,
    );

  /** 含 auth 未就绪：避免未登录占位与会话恢复提示同时出现 */
  const shellLoading =
    !isReady ||
    !persistHydrated ||
    (Boolean(activeConversationId) && messagesRestoring);

  const typingIndicator = showTypingIndicator ? (
    <div className="mx-auto flex w-full max-w-3xl animate-ios-fade-in">
      <div className="flex w-full flex-1 items-center gap-2 py-2 text-sm text-muted-foreground">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40" />
        </div>
        Nexus 正在思考…
      </div>
    </div>
  ) : null;

  const composerForm = (
    <form onSubmit={handleSubmit} className="relative mx-auto w-full max-w-3xl">
      <div
        className={cn(
          'flex items-center gap-2 rounded-[1.75rem] border border-gpt-border bg-gpt-composer px-2 py-2 pl-2.5 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/20 sm:gap-2.5'
        )}
      >
        <button
          type="button"
          onClick={() => setThinkingModeEnabled((v) => !v)}
          disabled={!canChat || isLoading}
          aria-pressed={thinkingModeEnabled}
          title={
            thinkingModeEnabled
              ? '思考模式已开：会展示推理过程，响应更慢'
              : '点击开启思考模式（展示推理，响应更慢）'
          }
          className={cn(
            'flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors sm:px-2.5',
            !canChat || isLoading
              ? 'cursor-not-allowed opacity-40'
              : thinkingModeEnabled
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/70'
          )}
        >
          <Sparkles className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">思考</span>
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          placeholder={
            !isReady
              ? ''
              : canChat
                ? '有问题，尽管问'
                : '登录后开始对话'
          }
          className="min-h-[40px] max-h-[200px] min-w-0 flex-1 resize-none border-none bg-transparent py-2 pl-0 pr-1 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
          rows={1}
          disabled={!canChat || isLoading}
        />
        <button
          type="submit"
          disabled={!canChat || !input.trim() || isLoading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:opacity-90 disabled:opacity-25 dark:bg-white dark:text-black"
          aria-label="发送"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );

  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-hidden bg-gpt-main text-foreground safe-area-pt">
      <header className="z-20 flex min-h-14 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10"
              aria-label="打开边栏"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <div className="relative min-w-0 w-auto max-w-[min(100vw-8rem,280px)] shrink-0 sm:max-w-[min(100vw-10rem,280px)]">
            <ModelSelect
              id="chat-header-model"
              value={resolvedModelValue}
              onChange={(v) => void handleModelChange(v)}
              options={chatModelOptions}
              className="w-full"
              disabled={!canChat}
            />
          </div>
          {isLoading && (
            <button
              type="button"
              onClick={handleStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/20"
              aria-label="停止生成"
            >
              <Square size={18} className="text-red-500" />
            </button>
          )}
        </div>
      </header>

      {shellLoading ? (
        <ChatShellSkeleton />
      ) : localMessages.length === 0 && !activeConversationId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 animate-ios-fade-in">
            <div className="flex w-full max-w-3xl flex-col items-center gap-8">
              <div className="text-center">
                <h2 className="text-[1.65rem] font-normal leading-snug tracking-tight text-foreground sm:text-3xl">
                  你今天在想些什么？
                </h2>
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  向 Nexus 提问、调用远程能力或与 MCP 工具协作。
                </p>
              </div>
              {typingIndicator}
              {composerForm}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto scroll-smooth px-3 py-4 sm:px-4 scrollbar-none"
          >
            {localMessages.map((msg) => {
              const isThisAssistantStreaming =
                msg.role === 'assistant' &&
                isLoading &&
                msg.id === streamingAssistantId;
              /** 流式生成中不展示复制/重新生成，等本条助手回复结束后再显示 */
              const showAssistantActions =
                msg.role === 'assistant' && !isThisAssistantStreaming;

              return (
              <div key={msg.id} className="space-y-2">
                {msg.role === 'assistant' &&
                  ((msg.thinkingLog && msg.thinkingLog.length > 0) ||
                    (thinkingModeEnabled &&
                      isLoading &&
                      msg.id === streamingAssistantId)) && (
                  <ThinkingTrace
                    logs={msg.thinkingLog ?? []}
                    stepDurationsMs={msg.thinkingStepDurationsMs}
                    isLoading={Boolean(
                      isLoading && msg.id === streamingAssistantId,
                    )}
                  />
                )}
                {!thinkingModeEnabled &&
                  isThisAssistantStreaming &&
                  !msg.content.trim() && <AssistantStreamDots />}
                <ChatMessage
                  message={msg as any}
                  onCopyAssistant={
                    showAssistantActions
                      ? () => void handleCopyAssistant(msg.content)
                      : undefined
                  }
                  onRegenerate={
                    showAssistantActions
                      ? () => void handleRegenerateAssistant(msg.id)
                      : undefined
                  }
                  regenerateDisabled={isLoading}
                />
              </div>
            );
            })}
            {typingIndicator}
          </div>
          <div className="shrink-0 px-3 pt-2 sm:px-4 pb-safe-composer">{composerForm}</div>
        </>
      )}
    </main>
  );
}
