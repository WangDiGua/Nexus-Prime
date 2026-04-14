'use client';

import dynamic from 'next/dynamic';
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useDeferredValue,
} from 'react';
import {
  ArrowUp,
  LayoutGrid,
  PanelLeft,
  Sparkles,
  Square,
  X,
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
  getWorkModeSummary,
  recommendSkills,
} from '@/lib/agent-workbench';
import {
  buildChatModelOptions,
  normalizeChatModelId,
} from '@/lib/chat-model-options';
import { registryClient } from '@/lib/registry-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from '@/lib/toast';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { useConversationStore } from '@/hooks/use-conversation-store';
import type { Message as StoredMessage } from '@/hooks/use-conversation-store';
import type {
  ChatSSEEvent,
  ToolCall,
  ToolInvocationView,
  ToolResult,
} from '@/types/chat';
import type { ChatSelectedSkill } from '@/components/chat/skill-store-sheet';
import type { Skill } from '@/types/registry';

const SkillStoreSheet = dynamic(
  () =>
    import('@/components/chat/skill-store-sheet').then(
      (mod) => mod.SkillStoreSheet,
    ),
  {
    ssr: false,
  },
);

export interface NexusChatProps {
  sidebarCollapsed?: boolean;
  onOpenSidebar?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocationView[];
  thinkingLog?: string[];
  /** 涓?thinkingLog 绛夐暱锛屾瘡姝ヨ€楁椂锛堟绉掞級 */
  thinkingStepDurationsMs?: number[];
}

function parseThinkingStepDurations(raw: unknown): number[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  }
  return undefined;
}

function normalizeToolInvocations(
  raw: unknown,
): ToolInvocationView[] | undefined {
  if (raw == null) return undefined;
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>)
      : [];

  const normalized = items
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const value = item as Record<string, unknown>;
      const result = value.result;
      const toolCallId = String(
        value.toolCallId ?? value.id ?? 'tool_' + index,
      );
      const toolName = String(value.toolName ?? 'tool');
      const args =
        value.args && typeof value.args === 'object' && !Array.isArray(value.args)
          ? (value.args as Record<string, unknown>)
          : {};
      const state =
        value.state === 'calling' || value.state === 'result'
          ? (value.state as 'calling' | 'result')
          : 'result';
      const normalizedResult =
        result && typeof result === 'object' && !Array.isArray(result)
          ? ({ ...result } as ToolResult)
          : undefined;
      return {
        toolCallId,
        toolName,
        args,
        state,
        result: normalizedResult,
      };
    })
    .filter(Boolean) as ToolInvocationView[];

  return normalized.length > 0 ? normalized : undefined;
}

/** 灏嗘湇鍔＄/ store 娑堟伅杞负 NexusChat 鏈湴 Message */
function mapStoredToLocalMessage(m: StoredMessage): Message {
  return {
    id: m.id,
    role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: m.content,
    thinkingLog: m.thinkingLog || undefined,
    thinkingStepDurationsMs: parseThinkingStepDurations(m.thinkingStepDurationsMs),
    toolInvocations: normalizeToolInvocations(m.toolResults),
  };
}

/** 鏈湴娑堟伅 鈫?store 褰㈡€侊紝渚?localStorage 缂撳瓨锛坈reatedAt 鐢ㄥ崰浣嶏紝閬垮厤闃叉姈搴忓垪鍖栨姈鍔級 */
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
    toolResults: m.toolInvocations ?? null,
    thinkingLog: m.thinkingLog ?? null,
    thinkingStepDurationsMs: m.thinkingStepDurationsMs ?? null,
    tokensUsed: 0,
    latencyMs: 0,
    createdAt: new Date(1000 + i),
  }));
}

function primitiveArrayEqual(
  left?: Array<string | number>,
  right?: Array<string | number>,
) {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function toolResultEqual(left?: ToolResult, right?: ToolResult) {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  return (
    left.status === right.status &&
    left.error === right.error &&
    JSON.stringify(left.result ?? null) === JSON.stringify(right.result ?? null)
  );
}

function toolInvocationsEqual(
  left?: ToolInvocationView[],
  right?: ToolInvocationView[],
) {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const leftItem = left[i];
    const rightItem = right[i];
    if (!leftItem || !rightItem) return false;
    if (
      leftItem.toolCallId !== rightItem.toolCallId ||
      leftItem.toolName !== rightItem.toolName ||
      leftItem.state !== rightItem.state ||
      JSON.stringify(leftItem.args ?? null) !== JSON.stringify(rightItem.args ?? null) ||
      !toolResultEqual(leftItem.result, rightItem.result)
    ) {
      return false;
    }
  }

  return true;
}

function messagesEqual(left: Message[], right: Message[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const leftMessage = left[i];
    const rightMessage = right[i];
    if (!leftMessage || !rightMessage) return false;
    if (
      leftMessage.id !== rightMessage.id ||
      leftMessage.role !== rightMessage.role ||
      leftMessage.content !== rightMessage.content ||
      !primitiveArrayEqual(leftMessage.thinkingLog, rightMessage.thinkingLog) ||
      !primitiveArrayEqual(
        leftMessage.thinkingStepDurationsMs,
        rightMessage.thinkingStepDurationsMs,
      ) ||
      !toolInvocationsEqual(
        leftMessage.toolInvocations,
        rightMessage.toolInvocations,
      )
    ) {
      return false;
    }
  }

  return true;
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
  /** 鍔犺浇缁撴潫鍚庡彲鎵嬪姩灞曞紑锛涘姞杞戒腑寮哄埗灞曞紑 */
  const [expandedAfterDone, setExpandedAfterDone] = useState(false);
  /** 宸插畬鎴愭楠わ細榛樿鍗曡鏀惰捣锛岀偣鍑诲睍寮€鍏ㄦ枃 */
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
                    ? '第' + reasoningRound + ' 轮思考'
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

/** 鏈紑鎬濊€冩ā寮忔椂锛氶鍖呭墠鍦ㄥ乏渚ф樉绀轰笁鐐癸紝閬垮厤绌虹櫧鍍忓崱姝?*/
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

/** 浼氳瘽鍖轰笌杈撳叆鏉￠鏋讹細閬垮厤銆屾仮澶嶄細璇濄€嶄笌銆岃鐧诲綍銆嶆枃妗堝悓鏃跺嚭鐜?*/
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

const TypingIndicator = React.memo(function TypingIndicator({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;
  return (
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
  );
});

const ChatHeader = React.memo(function ChatHeader({
  sidebarCollapsed,
  onOpenSidebar,
  resolvedModelValue,
  chatModelOptions,
  handleModelChange,
  canChat,
  isLoading,
  handleStop,
}: {
  sidebarCollapsed: boolean;
  onOpenSidebar?: () => void;
  resolvedModelValue: string;
  chatModelOptions: Array<{ value: string; label: string }>;
  handleModelChange: (value: string) => void | Promise<void>;
  canChat: boolean;
  isLoading: boolean;
  handleStop: () => void;
}) {
  return (
    <header className="z-20 flex min-h-14 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10"
            aria-label="打开侧边栏"
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
  );
});

const ChatComposer = React.memo(function ChatComposer({
  handleSubmit,
  canChat,
  isLoading,
  thinkingModeEnabled,
  setThinkingModeEnabled,
  selectedSkill,
  setSkillSheetOpen,
  setSelectedSkill,
  input,
  setInput,
  isReady,
}: {
  handleSubmit: (e: React.FormEvent) => Promise<void> | void;
  canChat: boolean;
  isLoading: boolean;
  thinkingModeEnabled: boolean;
  setThinkingModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSkill: ChatSelectedSkill | null;
  setSkillSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedSkill: React.Dispatch<React.SetStateAction<ChatSelectedSkill | null>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isReady: boolean;
}) {
  return (
    <form onSubmit={handleSubmit} className="relative mx-auto w-full max-w-3xl">
      <div
        className={cn(
          'flex flex-wrap items-end gap-2 rounded-[1.75rem] border border-gpt-border bg-gpt-composer px-2 py-2 pl-2.5 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/20',
          'sm:flex-nowrap sm:gap-2.5',
        )}
      >
        <button
          type="button"
          onClick={() => setThinkingModeEnabled((v) => !v)}
          disabled={!canChat || isLoading}
          aria-pressed={thinkingModeEnabled}
          title={
            thinkingModeEnabled
              ? '思考模式已开启：会展示推理过程，响应更慢'
              : '点击开启思考模式（展示推理过程，响应更慢）'
          }
          className={cn(
            'flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors sm:px-2.5',
            !canChat || isLoading
              ? 'cursor-not-allowed opacity-40'
              : thinkingModeEnabled
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/70',
          )}
        >
          <Sparkles className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">思考</span>
        </button>
        <button
          type="button"
          onClick={() => setSkillSheetOpen(true)}
          disabled={!canChat || isLoading}
          aria-pressed={Boolean(selectedSkill)}
          title={
            selectedSkill
              ? '当前技能：' + selectedSkill.name + '（点击更换）'
              : '技能商店：选择后作为对话工具入口'
          }
          className={cn(
            'flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors sm:px-2.5',
            !canChat || isLoading
              ? 'cursor-not-allowed opacity-40'
              : selectedSkill
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/70',
          )}
        >
          <LayoutGrid className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">技能</span>
        </button>
        {selectedSkill ? (
          <div className="flex min-h-9 w-full min-w-0 basis-full items-center gap-0.5 rounded-full bg-muted/80 py-1 pl-2 pr-1 text-xs text-foreground sm:w-auto sm:max-w-[min(40%,220px)] sm:basis-auto">
            <span className="min-w-0 flex-1 truncate font-medium sm:flex-initial" title={selectedSkill.name}>
              {selectedSkill.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedSkill(null)}
              disabled={!canChat || isLoading}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
              aria-label="清除所选技能"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex min-h-[44px] min-w-0 flex-1 basis-full items-end gap-2 sm:min-h-0 sm:basis-0 sm:min-w-[8rem]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder={
              !isReady ? '' : canChat ? '有问题，尽管问' : '登录后开始对话'
            }
            className="min-h-[44px] max-h-[200px] min-w-0 flex-1 resize-none border-none bg-transparent py-2.5 pl-0 pr-1 text-[15px] leading-normal text-foreground placeholder:text-muted-foreground focus:outline-none sm:min-h-[40px] sm:py-2 sm:leading-6"
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
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-muted-foreground">
        <span>
          {selectedSkill
            ? '当前会话会优先围绕“' + selectedSkill.name + '”调用更合适的工具。'
            : '先直接描述任务，系统会根据上下文决定是否需要调用工具。'}
        </span>
        <span>Enter 发送，Shift + Enter 换行</span>
      </div>
    </form>
  );
});

function WorkModeBanner({
  title,
  description,
  chips,
}: {
  title: string;
  description: string;
  chips: string[];
}) {
  return (
    <div className="px-3 pt-3 sm:px-4">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillSuggestions({
  skills,
  onSelect,
}: {
  skills: Skill[];
  onSelect: (skill: ChatSelectedSkill) => void;
}) {
  if (skills.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
        <p className="text-sm font-medium text-foreground">建议使用这些技能</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          如果你的目标很明确，选一个技能后通常能更快进入任务执行状态。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() =>
                onSelect({
                  id: skill.id,
                  name: skill.name,
                  icon: skill.icon,
                })
              }
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {skill.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const ChatMessageList = React.memo(function ChatMessageList({
  localMessages,
  regenerateDisabled,
  streamingAssistantId,
  thinkingModeEnabled,
  handleCopyAssistant,
  handleRegenerateAssistant,
  scrollRef,
  showTypingIndicator,
}: {
  localMessages: Message[];
  regenerateDisabled: boolean;
  streamingAssistantId: string | null;
  thinkingModeEnabled: boolean;
  handleCopyAssistant: (text: string) => Promise<void>;
  handleRegenerateAssistant: (assistantMessageId: string) => Promise<void>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  showTypingIndicator: boolean;
}) {
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 space-y-6 overflow-y-auto scroll-smooth px-3 py-4 sm:px-4 scrollbar-none"
    >
      {localMessages.map((msg) => {
        const isStreaming =
          msg.role === 'assistant' &&
          regenerateDisabled &&
          msg.id === streamingAssistantId;

        return (
          <ChatMessageRow
            key={msg.id}
            message={msg}
            isStreaming={isStreaming}
            showThinkingTrace={
              msg.role === 'assistant' &&
              ((msg.thinkingLog && msg.thinkingLog.length > 0) ||
                (thinkingModeEnabled && isStreaming))
            }
            showDots={
              !thinkingModeEnabled &&
              isStreaming &&
              !msg.content.trim()
            }
            showAssistantActions={
              msg.role === 'assistant' && !isStreaming
            }
            regenerateDisabled={regenerateDisabled}
            handleCopyAssistant={handleCopyAssistant}
            handleRegenerateAssistant={handleRegenerateAssistant}
          />
        );
      })}
      <TypingIndicator visible={showTypingIndicator} />
    </div>
  );
});

const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  isStreaming,
  showThinkingTrace,
  showDots,
  showAssistantActions,
  regenerateDisabled,
  handleCopyAssistant,
  handleRegenerateAssistant,
}: {
  message: Message;
  isStreaming: boolean;
  showThinkingTrace: boolean;
  showDots: boolean;
  showAssistantActions: boolean;
  regenerateDisabled: boolean;
  handleCopyAssistant: (text: string) => Promise<void>;
  handleRegenerateAssistant: (assistantMessageId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      {showThinkingTrace && (
          <ThinkingTrace
            logs={message.thinkingLog ?? []}
            stepDurationsMs={message.thinkingStepDurationsMs}
            isLoading={isStreaming}
          />
        )}
      {showDots && <AssistantStreamDots />}
      <ChatMessage
        message={message as any}
        onCopyAssistant={
          showAssistantActions
            ? () => void handleCopyAssistant(message.content)
            : undefined
        }
        onRegenerate={
          showAssistantActions
            ? () => void handleRegenerateAssistant(message.id)
            : undefined
        }
        regenerateDisabled={regenerateDisabled}
      />
    </div>
  );
}, (prev, next) => {
  return (
    prev.message === next.message &&
    prev.isStreaming === next.isStreaming &&
    prev.showThinkingTrace === next.showThinkingTrace &&
    prev.showDots === next.showDots &&
    prev.showAssistantActions === next.showAssistantActions &&
    prev.regenerateDisabled === next.regenerateDisabled &&
    prev.handleCopyAssistant === next.handleCopyAssistant &&
    prev.handleRegenerateAssistant === next.handleRegenerateAssistant
  );
});

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
   * 蹇呴』涓?SSR 棣栧睆涓€鑷达細涓嶅彲鍦?useState 鍒濆鍊奸噷璇?hasHydrated()锛?
   * 鍚﹀垯瀹㈡埛绔甯у彲鑳藉凡涓?true锛屾湇鍔＄濮嬬粓涓?false锛岃Е鍙?hydration mismatch銆?
   */
  const [persistHydrated, setPersistHydrated] = useState(false);
  /** 姝ｅ湪浠庢湇鍔＄鎷夊彇褰撳墠浼氳瘽娑堟伅锛堝埛鏂板悗锛?*/
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

  /** 褰撳墠杩欐璇锋眰瀵瑰簲鐨勫姪鎵嬫秷鎭?id锛堥鍖?SSE 鍓嶅凡鎻掑叆鍗犱綅锛岄伩鍏嶈鐢ㄣ€屼笂涓€鏉″姪鎵嬨€嶏級 */
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(
    null,
  );

  /** 鏄惁鍚戠櫨鐐艰姹傛€濊€冮摼锛坮easoning锛夛紱鎸佷箙鍖栧埌 localStorage */
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

  /** 閫変腑鐨勬妧鑳戒綔涓?chat 鍏ュ彛璧勬簮锛坋ntryResource锛夛紝褰卞搷鑱氬悎宸ュ叿鍒楄〃 */
  const [selectedSkill, setSelectedSkill] = useState<ChatSelectedSkill | null>(
    null,
  );
  const [skillSheetOpen, setSkillSheetOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('nexus-prime:chat-entry-skill');
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatSelectedSkill;
      if (parsed?.id && typeof parsed.name === 'string') {
        setSelectedSkill(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      if (selectedSkill) {
        window.localStorage.setItem(
          'nexus-prime:chat-entry-skill',
          JSON.stringify(selectedSkill),
        );
      } else {
        window.localStorage.removeItem('nexus-prime:chat-entry-skill');
      }
    } catch {
      /* ignore */
    }
  }, [selectedSkill]);

  useEffect(() => {
    let cancelled = false;

    const loadSkills = async () => {
      try {
        const capabilities = await registryClient.fetchCapabilities();
        if (!cancelled) {
          setAvailableSkills(capabilities.skills);
        }
      } catch {
        if (!cancelled) {
          setAvailableSkills([]);
        }
      }
    };

    void loadSkills();

    return () => {
      cancelled = true;
    };
  }, []);

  const prevActiveConversationId = useRef<string | null>(activeConversationId);
  /** 浠呯敤浜庢仮澶嶆媺鍙栵細棣栧抚涓?null锛屼究浜庡湪銆屽埛鏂?/ 棣栨杩涘叆甯?id銆嶆椂涓庡綋鍓?id 姣旇緝涓哄凡鍙樺寲锛屼粠鑰屽繀瀹氳姹傛湇鍔＄ */
  const restorePrevConversationIdRef = useRef<string | null>(null);
  const localMessagesRef = useRef<Message[]>([]);
  localMessagesRef.current = localMessages;
  const deferredMessages = useDeferredValue(localMessages);
  const recommendedSkills = useMemo(
    () => recommendSkills(availableSkills, input),
    [availableSkills, input],
  );
  const workModeSummary = useMemo(
    () =>
      getWorkModeSummary({
        canChat,
        thinkingModeEnabled,
        selectedSkill,
      }),
    [canChat, selectedSkill, thinkingModeEnabled],
  );

  /** 鏈嶅姟绔?鎸佷箙鍖?store 鏇存柊鏃跺悓姝ュ埌鏈湴锛涗笌鏈湴鎸囩汗涓€鑷村垯璺宠繃锛岄伩鍏嶄笌銆屾湰鍦扳啋store 闃叉姈銆嶄簰鐩告墦鏋?*/
  useEffect(() => {
    if (storedMessages.length === 0) return;
    const fromStored = storedMessages.map(mapStoredToLocalMessage);
    if (messagesEqual(fromStored, localMessagesRef.current)) {
      return;
    }
    setLocalMessages(fromStored);
  }, [storedMessages]);

  const lastPersistedMessagesRef = useRef<Message[]>([]);

  /** 鏈湴瀵硅瘽 鈫?zustand persist锛坙ocalStorage锛夛紝瀹炵幇娴忚鍣ㄤ晶缂撳瓨锛屼緵鍒锋柊鍚庡厛灞曠ず鍐嶄笌 DB 瀵归綈 */
  useEffect(() => {
    if (!activeConversationId || !persistHydrated) return;

    const t = window.setTimeout(() => {
      if (messagesEqual(localMessages, lastPersistedMessagesRef.current)) return;
      lastPersistedMessagesRef.current = localMessages;
      setStoredMessages(
        localMessagesToStored(activeConversationId, localMessages),
      );
    }, 350);
    return () => window.clearTimeout(t);
  }, [localMessages, activeConversationId, persistHydrated, setStoredMessages]);

  /**
   * 绫荤紦瀛樼瓥鐣ワ細persist 閲峢ydrate 鍚庤嫢鏈変笌褰撳墠浼氳瘽 id 涓€鑷寸殑鏈湴 messages锛屽厛鐩存帴灞曠ず锛堟祻瑙堝櫒涓€绾х紦瀛橈級锛?
   * 鍚屾椂鍚庡彴璇锋眰鏁版嵁搴撳苟浠ユ湇鍔＄缁撴灉涓哄噯瑕嗙洊锛涙棤鏈湴缂撳瓨鏃舵墠鏄剧ず銆屾仮澶嶄腑銆嶃€?
   * 鍚屼竴浼氳瘽涓旀鍦ㄦ祦寮忔椂涓嶆媺鍙栵紝閬垮厤瑕嗙洊涔愯 UI銆?
   * 鍒囧嬁灏?isLoading 鍒楀叆渚濊禆锛氭祦寮忕粨鏉?isLoading鈫抐alse 浼氬啀娆¤窇鏈?effect 骞惰姹?API锛?
   * 鑻ヨ姹傛棭浜庡姪鎵嬫秷鎭惤搴撴垨涓?DB 绔炴€侊紝浼氱敤涓嶅畬鏁村垪琛ㄨ鐩?localMessages锛屽鑷淬€屽洖澶嶅悗鍐呭娑堝け銆嶃€?
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
     * 棣栨潯娑堟伅浼氬厛 setIsLoading(true)锛屽啀 POST 鍒涘缓浼氳瘽骞?setActiveConversation(null鈫抜d)銆?
     * 姝ゆ椂鑻ユ寜銆屼細璇濆垏鎹€嶆竻绌哄苟鎷夊彇锛屼細鎶规帀涔愯鎻掑叆鐨勭敤鎴?鍔╂墜鍗犱綅銆?
     */
    if (conversationChanged && prev === null && isLoading) {
      restorePrevConversationIdRef.current = activeConversationId;
      return;
    }

    restorePrevConversationIdRef.current = activeConversationId;

    /** 浠呬細璇?A鈫払 鍒囨崲鏃舵竻绌猴紱鍒锋柊(null鈫抜d) 淇濈暀宸查噸hydrate 鐨勬湰鍦扮紦瀛?*/
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
        const response = await fetch('/api/conversations/' + activeConversationId + '?messages=true');
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
            (m.toolResults as unknown) ??
            (m.toolInvocations as unknown) ??
            null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isLoading 涓嶅垪鍏ワ紝閬垮厤娴佸紡缁撴潫鍚庨噸澶嶆媺 API 瑕嗙洊鐣岄潰
  }, [canChat, activeConversationId, setStoredMessages, persistHydrated]);

  /** 浠呭湪銆屾柊寤轰細璇濄€嶄粠鏈?id 鈫?null 鏃舵竻绌烘湰鍦版秷鎭?*/
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
    toolResults?: unknown,
    /** 褰撳墠杞浣跨敤鐨勬ā鍨?id锛堜笌澶撮儴 ModelSelect / 鏈嶅姟绔?chat 涓€鑷达級 */
    model?: string
  ) => {
    try {
      const response = await fetch('/api/conversations/' + conversationId + '/messages', {
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
          ...(toolResults ? { toolResults } : {}),
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
      /** 鏈€夋妧鑳芥椂鐢辨湇鍔＄浣跨敤榛樿 entry锛坅pi-config锛?*/
      entrySkill: ChatSelectedSkill | null;
    }) => {
      const {
        assistantMessageId,
        apiMessages,
        conversationId: currentConversationId,
        controller,
        enableThinking,
        entrySkill,
      } = params;

      /** 鏈紑鍚€屾€濊€冦€嶆椂涓嶅睍绀?涓嶈惤搴?ReAct 鎬濈淮閾撅紙浠嶈蛋宸ュ叿璋冪敤涓庢鏂囨祦锛?*/
      const collectThinkingUi = enableThinking;

      /** 鏈疆璇锋眰瀵瑰簲鐨勬ā鍨嬶紙涓庡ご閮ㄩ€夋嫨鍣ㄤ竴鑷达紝渚涜惤搴擄級 */
      const modelForThisTurn = resolvedModelValue;

      let currentContent = '';
      let currentToolInvocations: NonNullable<Message['toolInvocations']> = [];
      let currentThinkingLog: string[] = [];
      let currentThinkingDurationsMs: number[] = [];
      let thinkingStepStartedAt = Date.now();
      /** 鏄惁澶勪簬鍚屼竴杞€屾ā鍨嬫€濊€冦€嶆祦寮忕墖娈典腑锛坮easoning_delta锛?*/
      let reasoningDeltaOpen = false;
      let pendingUiFlush = false;
      let animationFrameId: number | null = null;

      const syncAssistantMessage = () => {
        pendingUiFlush = false;
        setLocalMessages((prev) => {
          const nextAssistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: currentContent,
            toolInvocations: [...currentToolInvocations],
            thinkingLog: [...currentThinkingLog],
            thinkingStepDurationsMs: [...currentThinkingDurationsMs],
          };
          const existingIndex = prev.findIndex((m) => m.id === assistantMessageId);
          if (existingIndex === -1) {
            return [...prev, nextAssistantMessage];
          }
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            ...nextAssistantMessage,
          };
          return next;
        });
      };

      const scheduleAssistantSync = () => {
        if (pendingUiFlush) return;
        pendingUiFlush = true;
        if (typeof window === 'undefined') {
          syncAssistantMessage();
          return;
        }
        animationFrameId = window.requestAnimationFrame(() => {
          animationFrameId = null;
          syncAssistantMessage();
        });
      };

      const flushAssistantSync = () => {
        if (animationFrameId !== null && typeof window !== 'undefined') {
          window.cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        syncAssistantMessage();
      };

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
            ...(entrySkill
              ? {
                  entryResourceType: 'skill',
                  entryResourceId: entrySkill.id,
                }
              : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + response.statusText);
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
                    scheduleAssistantSync();
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
                    scheduleAssistantSync();
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
                    scheduleAssistantSync();
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
                      id: 'call_' + toolCall.id,
                      type: '工具',
                      method: 'POST',
                      endpoint: '/invoke/' + toolCall.name,
                      status: 0,
                      time: '调用中...',
                      payload: toolCall.args
                    });

                    scheduleAssistantSync();
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
                        id: 'result_' + result.toolCallId,
                        type: '工具',
                        method: 'POST',
                        endpoint: '/invoke/' + result.toolName,
                        status: result.status === 'success' ? 200 : 500,
                        time: String(result.latency || 0) + 'ms',
                        payload: result.args,
                        response: result.result,
                      });

                      scheduleAssistantSync();
                    }
                    break;
                  }

                  case 'error':
                    setLocalMessages(prev => [...prev, {
                      id: Math.random().toString(36).substring(7),
                      role: 'assistant',
                      content: '错误: ' + event.error,
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
              scheduleAssistantSync();
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
              scheduleAssistantSync();
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
          content: '请求出错：' + detail + '\\n\\n请确认服务端已配置 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL，并确保 LantuConnect-Backend 服务正在运行。',
        }]);
      } finally {
        finalizeLastThinkingStep();
        flushAssistantSync();
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
            currentToolInvocations,
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
        if (animationFrameId !== null && typeof window !== 'undefined') {
          window.cancelAnimationFrame(animationFrameId);
        }
        if (currentConversationId) {
          bumpConversationList();
        }
      }
    },
    [
      saveMessageToDB,
      addPacket,
      updateContext,
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
        entrySkill: selectedSkill,
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
      selectedSkill,
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
      entrySkill: selectedSkill,
    });
  };

  /**
   * 棣栧寘 SSE 鍓嶅凡鎻掑叆鍔╂墜鍗犱綅 + 鎬濈淮閾惧崰浣嶏紱浠呭綋娌℃湁褰撳墠娴佸紡鍔╂墜 id 鏃跺厹搴曟樉绀哄簳閮ㄣ€屾鍦ㄦ€濊€冦€嶃€?
   */
  const showTypingIndicator =
    isLoading &&
    !localMessages.some(
      (m) => m.role === 'assistant' && m.id === streamingAssistantId,
    );

  /** 鍚?auth 鏈氨缁細閬垮厤鏈櫥褰曞崰浣嶄笌浼氳瘽鎭㈠鎻愮ず鍚屾椂鍑虹幇 */
  const shellLoading =
    !isReady ||
    !persistHydrated ||
    (Boolean(activeConversationId) && messagesRestoring);

  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-hidden bg-gpt-main text-foreground safe-area-pt">
      <ChatHeader
        sidebarCollapsed={sidebarCollapsed}
        onOpenSidebar={onOpenSidebar}
        resolvedModelValue={resolvedModelValue}
        chatModelOptions={chatModelOptions}
        handleModelChange={handleModelChange}
        canChat={canChat}
        isLoading={isLoading}
        handleStop={handleStop}
      />
      <WorkModeBanner
        title={workModeSummary.title}
        description={workModeSummary.description}
        chips={workModeSummary.chips}
      />

      {shellLoading ? (
        <ChatShellSkeleton />
      ) : localMessages.length === 0 && !activeConversationId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 animate-ios-fade-in">
            <div className="flex w-full max-w-3xl flex-col items-center gap-8">
              <div className="text-center">
                <h2 className="text-[1.65rem] font-normal leading-snug tracking-tight text-foreground sm:text-3xl">
                  说出任务目标，我来帮你把它做完。
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  你可以直接提问、整理资料、生成内容、做图表，或者先让我判断该调用哪种能力。
                </p>
              </div>
              <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  '帮我整理一份竞品调研提纲，并列出下一步访谈问题',
                  '把这组数据做成图表，并告诉我最值得关注的异常点',
                  '根据会议纪要生成一封对外同步邮件，语气专业但简洁',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-left text-sm leading-6 text-foreground transition-colors hover:bg-muted/40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {!selectedSkill ? (
                <SkillSuggestions
                  skills={recommendedSkills}
                  onSelect={setSelectedSkill}
                />
              ) : null}
              <TypingIndicator visible={showTypingIndicator} />
              <ChatComposer
                handleSubmit={handleSubmit}
                canChat={canChat}
                isLoading={isLoading}
                thinkingModeEnabled={thinkingModeEnabled}
                setThinkingModeEnabled={setThinkingModeEnabled}
                selectedSkill={selectedSkill}
                setSkillSheetOpen={setSkillSheetOpen}
                setSelectedSkill={setSelectedSkill}
                input={input}
                setInput={setInput}
                isReady={isReady}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <ChatMessageList
            localMessages={deferredMessages}
            regenerateDisabled={isLoading}
            streamingAssistantId={streamingAssistantId}
            thinkingModeEnabled={thinkingModeEnabled}
            handleCopyAssistant={handleCopyAssistant}
            handleRegenerateAssistant={handleRegenerateAssistant}
            scrollRef={scrollRef}
            showTypingIndicator={showTypingIndicator}
          />
          <div className="shrink-0 px-3 pt-2 sm:px-4 pb-safe-composer">
            {!selectedSkill && input.trim().length > 0 ? (
              <div className="mb-3">
                <SkillSuggestions
                  skills={recommendedSkills}
                  onSelect={setSelectedSkill}
                />
              </div>
            ) : null}
            <ChatComposer
              handleSubmit={handleSubmit}
              canChat={canChat}
              isLoading={isLoading}
              thinkingModeEnabled={thinkingModeEnabled}
              setThinkingModeEnabled={setThinkingModeEnabled}
              selectedSkill={selectedSkill}
              setSkillSheetOpen={setSkillSheetOpen}
              setSelectedSkill={setSelectedSkill}
              input={input}
              setInput={setInput}
              isReady={isReady}
            />
          </div>
        </>
      )}
      <SkillStoreSheet
        open={skillSheetOpen}
        onOpenChange={setSkillSheetOpen}
        selected={selectedSkill}
        onSelect={setSelectedSkill}
        onClearSelection={() => setSelectedSkill(null)}
      />
    </main>
  );
}
