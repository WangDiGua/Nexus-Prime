'use client';

import React, { useRef, useEffect, useState } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  Zap,
  Mail,
  BarChart3,
  Globe,
  Database
} from 'lucide-react';
import ChatMessage from '@/components/chat/ChatMessage';
import { cn } from '@/lib/utils';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { registryClient } from '@/lib/registry-client';

// 定义消息类型，保持与 ChatMessage 组件兼容
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: any[];
}

export default function NexusChat() {
  const { addPacket, updateContext, config } = useRegistryStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user', content: input },
          ],
        }),
      });

      const rawBody = await apiRes.text();
      let payload: Record<string, unknown>;
      try {
        payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
      } catch {
        throw new Error(
          `接口返回非 JSON（HTTP ${apiRes.status}）：${rawBody.slice(0, 400)}`
        );
      }

      if (!apiRes.ok) {
        const err = payload.error;
        const msg =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
              ? String((err as { message: string }).message)
              : JSON.stringify(err ?? payload);
        throw new Error(`请求失败（${apiRes.status}）：${msg}`);
      }

      const { text, functionCalls } = payload as {
        text?: string;
        functionCalls?: { id: string; name: string; args: Record<string, unknown> }[];
      };

      let assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: text || '',
      };

      if (functionCalls?.length) {
        const toolInvocations = [];
        for (const call of functionCalls) {
          const toolCallId = call.id || Math.random().toString(36).substring(7);
          
          addPacket({
            id: toolCallId,
            type: '技能',
            method: 'POST',
            endpoint: `/api/chat#${call.name}`,
            status: 200,
            time: '调用中...',
            payload: call.args
          });

          toolInvocations.push({
            toolCallId,
            toolName: call.name,
            args: call.args,
            state: 'calling'
          });

          let result;
          const startTime = Date.now();
          if (call.name === 'query_database') {
            result = await registryClient.remoteInvoke({
              id: 'skill-db',
              name: '数据库查询',
              type: '远程',
              icon: 'Database',
              endpoint: 'https://api.lantu.com/v1/db/query',
              description: '内部数据库访问接口'
            }, call.args as Record<string, string>);
          } else if (call.name === 'send_email') {
            result = await registryClient.remoteInvoke({
              id: 'skill-email',
              name: '发送邮件',
              type: '远程',
              icon: 'Mail',
              endpoint: 'https://api.lantu.com/v1/email',
              description: 'SMTP 邮件发送服务'
            }, call.args as Record<string, string>);
          }

          toolInvocations[toolInvocations.length - 1] = {
            ...toolInvocations[toolInvocations.length - 1],
            state: 'result',
            result
          };
        }
        assistantMessage.toolInvocations = toolInvocations;
      }

      setMessages(prev => [...prev, assistantMessage]);
      updateContext(
        Math.floor(Math.random() * 500) + 1000,
        { last_response: "Success", timestamp: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Chat API Error:', error);
      const detail = error instanceof Error ? error.message : String(error);
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: `请求出错：${detail}\n\n请确认服务端已配置 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL（开发环境可用 .env.local），并与百炼控制台地域、模型开通情况一致。`
      }]);
    } finally {
      setIsLoading(false);
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
      {/* 聊天头部 - iOS Glass Effect */}
      <div className="h-16 ios-glass flex items-center px-6 justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Bot size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Nexus-Prime</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-ios-green animate-status-pulse" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">在线 • {config.model}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <Zap size={18} className="text-ios-orange" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
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

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg as any} />
        ))}

        {isLoading && (
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

      {/* 输入区域 - iOS Style */}
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
            Powered by DashScope
          </p>
        </div>
      </div>
    </main>
  );
}

