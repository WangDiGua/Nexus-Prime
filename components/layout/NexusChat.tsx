'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  Zap,
  Mail,
  BarChart3,
  Globe,
  Database,
  Square
} from 'lucide-react';
import ChatMessage from '@/components/chat/ChatMessage';
import { cn } from '@/lib/utils';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { useConversationStore } from '@/hooks/use-conversation-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NexusLogo } from '@/components/ui/nexus-logo';
import type { ChatSSEEvent, ToolCall, ToolResult } from '@/types/chat';

function ThinkingTrace({ logs, isLoading }: { logs: string[]; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="max-w-3xl mx-auto animate-ios-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-xs font-medium text-muted-foreground w-fit"
      >
        <div className="flex gap-0.5">
          {(isLoading ? [...logs, ''] : logs).map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-1 h-1 rounded-full",
                i < (isLoading ? logs.length : logs.length)
                  ? "bg-primary/60"
                  : "bg-primary/30 animate-pulse"
              )}
            />
          ))}
        </div>
        <span>🧠 ReAct 思考链路 ({logs.length} 步)</span>
        <svg
          className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-2 p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/50 border border-border space-y-1 max-h-60 overflow-y-auto">
          {logs.map((log, i) => (
            <div
              key={i}
              className={cn(
                "text-xs font-mono px-2 py-1 rounded flex items-start gap-2",
                log.includes('✅') && "text-emerald-500 dark:text-emerald-400",
                log.includes('❌') && "text-red-500 dark:text-red-400",
                log.includes('🔧') && "text-amber-500 dark:text-amber-400",
                log.includes('⚡') && "text-blue-500 dark:text-blue-400",
                !log.includes('✅') && !log.includes('❌') && !log.includes('🔧') && !log.includes('⚡') && "text-muted-foreground"
              )}
            >
              <span className="text-muted-foreground/60 shrink-0 select-none">{String(i + 1).padStart(2, '0')}</span>
              <span>{log}</span>
            </div>
          ))}
          {isLoading && (
            <div className="text-xs font-mono px-2 py-1 rounded flex items-center gap-2 text-primary/70">
              <span className="text-muted-foreground/60 shrink-0">{String(logs.length + 1).padStart(2, '0')}</span>
              <span className="animate-pulse">思考中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
}

export default function NexusChat() {
  const { addPacket, updateContext, config } = useRegistryStore();
  const { 
    activeConversationId, 
    messages: storedMessages, 
    setMessages: setStoredMessages,
    setActiveConversation 
  } = useConversationStore();
  
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storedMessages.length > 0) {
      const converted = storedMessages.map(m => ({
        id: m.id,
        role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: m.content,
        thinkingLog: m.thinkingLog || undefined,
      }));
      setLocalMessages(converted);
    } else {
      setLocalMessages([]);
    }
  }, [storedMessages, activeConversationId]);

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
    tokensUsed?: number
  ) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          thinkingLog: thinkingLog ? thinkingLog.reduce((acc, log, i) => ({ ...acc, [i]: log }), {}) : null,
          tokensUsed: tokensUsed || 0,
        }),
      });
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
    }
  }, [abortController]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: input
    };

    setLocalMessages(prev => [...prev, userMessage]);
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
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    }

    if (currentConversationId) {
      await saveMessageToDB('USER', userMessage.content, currentConversationId);
    }

    const assistantMessageId = Math.random().toString(36).substring(7);
    let currentContent = '';
    let currentToolInvocations: Message['toolInvocations'] = [];
    let currentThinkingLog: string[] = [];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversationId,
          messages: [
            ...localMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user', content: userMessage.content },
          ],
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as ChatSSEEvent;

              switch (event.type) {
                case 'thinking':
                  currentThinkingLog.push(event.content);
                  setLocalMessages(prev => {
                    const existing = prev.find(m => m.id === assistantMessageId);
                    if (existing) {
                      return prev.map(m =>
                        m.id === assistantMessageId
                          ? { ...m, content: currentContent, toolInvocations: currentToolInvocations, thinkingLog: [...currentThinkingLog] }
                          : m
                      );
                    }
                    return [...prev, {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: currentContent,
                      toolInvocations: currentToolInvocations,
                      thinkingLog: [...currentThinkingLog],
                    }];
                  });
                  break;

                case 'content':
                  currentContent += event.content;
                  setLocalMessages(prev => {
                    const existing = prev.find(m => m.id === assistantMessageId);
                    if (existing) {
                      return prev.map(m =>
                        m.id === assistantMessageId
                          ? { ...m, content: currentContent, toolInvocations: currentToolInvocations, thinkingLog: [...currentThinkingLog] }
                          : m
                      );
                    }
                    return [...prev, {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: currentContent,
                      toolInvocations: currentToolInvocations,
                      thinkingLog: [...currentThinkingLog],
                    }];
                  });
                  break;

                case 'tool_call':
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
                          ? { ...m, content: currentContent, toolInvocations: [...currentToolInvocations], thinkingLog: [...currentThinkingLog] }
                          : m
                      );
                    }
                    return [...prev, {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: currentContent,
                      toolInvocations: [...currentToolInvocations],
                      thinkingLog: [...currentThinkingLog],
                    }];
                  });
                  break;

                case 'tool_result':
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
                        ? { ...m, toolInvocations: [...currentToolInvocations], thinkingLog: [...currentThinkingLog] }
                        : m
                    ));
                  }
                  break;

                case 'error':
                  setLocalMessages(prev => [...prev, {
                    id: Math.random().toString(36).substring(7),
                    role: 'assistant',
                    content: `错误: ${event.error}`,
                  }]);
                  break;

                case 'done':
                  if (currentConversationId && currentContent) {
                    await saveMessageToDB(
                      'ASSISTANT', 
                      currentContent, 
                      currentConversationId, 
                      currentThinkingLog
                    );
                  }
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
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Chat API Error:', error);
      const detail = error instanceof Error ? error.message : String(error);
      setLocalMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: `请求出错：${detail}\n\n请确认服务端已配置 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL，并确保 LantuConnect-Backend 服务正在运行。`
      }]);
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const availableSkills = [
    { name: '邮件', icon: Mail, color: 'text-ios-blue' },
    { name: '图表', icon: BarChart3, color: 'text-ios-purple' },
    { name: '搜索', icon: Globe, color: 'text-ios-green' },
    { name: '数据', icon: Database, color: 'text-ios-orange' },
  ];

  return (
    <main className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="h-16 ios-glass flex items-center px-6 justify-between z-20">
        <div className="flex items-center gap-3">
          <NexusLogo showText={false} size="sm" />
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">NEXUS<tspan className="text-primary">PRIME</tspan></h1>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-status-pulse",
                isLoading ? "bg-ios-orange" : "bg-ios-green"
              )} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {isLoading ? '思考中...' : `在线 • ${config.model}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <button 
              onClick={handleStop}
              className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <Square size={18} className="text-red-500" />
            </button>
          )}
          <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <Zap size={18} className="text-ios-orange" />
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {localMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-6 animate-ios-fade-in">
            <div className="w-20 h-20 rounded-[28%] bg-primary flex items-center justify-center shadow-2xl shadow-primary/30">
              <Bot size={40} className="text-white" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-xl font-bold text-foreground tracking-tight">欢迎使用 Nexus</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                您的智能 Agent 交互终端。已装备远程能力与 MCP 协议。
              </p>
            </div>
          </div>
        )}

        {localMessages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {msg.role === 'assistant' && msg.thinkingLog && msg.thinkingLog.length > 0 && (
              <ThinkingTrace logs={msg.thinkingLog} isLoading={isLoading && !msg.content} />
            )}
            <ChatMessage message={msg as any} />
          </div>
        ))}

        {isLoading && !localMessages.some(m => m.role === 'assistant' && m.content) && (
          <div className="flex gap-3 max-w-3xl mx-auto animate-ios-fade-in">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-muted-foreground text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
              </div>
              Nexus 正在思考...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 pb-8 ios-glass border-t-0">
        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative"
        >
          <div className="ios-card p-1.5 flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <div className="flex gap-1 p-1">
              <TooltipProvider>
                {availableSkills.map((skill) => (
                  <Tooltip key={skill.name}>
                    <TooltipTrigger className={cn("p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all", skill.color)}>
                      <skill.icon size={16} />
                    </TooltipTrigger>
                    <TooltipContent className="ios-glass border-none text-[10px] font-semibold">
                      {skill.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="输入指令..."
              className="flex-1 bg-transparent border-none px-2 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none min-h-[44px] max-h-[200px]"
              rows={1}
              disabled={isLoading}
            />
            
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 active:scale-90 disabled:opacity-30 disabled:active:scale-100 transition-all shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="flex items-center justify-center gap-2 mt-4 opacity-40">
          <Sparkles size={12} className="text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Powered by DashScope + LantuConnect
          </p>
        </div>
      </div>
    </main>
  );
}
