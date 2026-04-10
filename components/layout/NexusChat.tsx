'use client';

import React, { useRef, useEffect, useState } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  Zap,
  Loader2,
  Mail,
  BarChart3,
  Globe,
  Database
} from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
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

  // 初始化 Gemini AI
  const ai = new GoogleGenAI({ 
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' 
  });

  // 定义工具
  const queryDatabaseTool: FunctionDeclaration = {
    name: "query_database",
    parameters: {
      type: Type.OBJECT,
      description: "查询远程数据库以获取用户信息",
      properties: {
        table: { type: Type.STRING, description: "要查询的表名" },
        query: { type: Type.STRING, description: "查询条件" },
      },
      required: ["table", "query"],
    },
  };

  const sendEmailTool: FunctionDeclaration = {
    name: "send_email",
    parameters: {
      type: Type.OBJECT,
      description: "发送电子邮件",
      properties: {
        to: { type: Type.STRING, description: "收件人邮箱" },
        subject: { type: Type.STRING, description: "邮件主题" },
        body: { type: Type.STRING, description: "邮件内容" },
      },
      required: ["to", "subject", "body"],
    },
  };

  const tools = [{ functionDeclarations: [queryDatabaseTool, sendEmailTool] }];

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
      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...history, { role: 'user', parts: [{ text: input }] }],
        config: {
          systemInstruction: `你是一个名为 Nexus-Prime 的高级 AI 助手。
          你拥有访问远程能力（Skills）和 MCP 服务器的权限。
          当用户要求执行特定任务时，优先考虑使用工具。
          在调用工具前，请简要说明你的思考过程。`,
          tools,
        },
      });

      let assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: response.text || ''
      };

      if (response.functionCalls) {
        const toolInvocations = [];
        for (const call of response.functionCalls) {
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
            }, call.args);
          } else if (call.name === 'send_email') {
            result = await registryClient.remoteInvoke({
              id: 'skill-email',
              name: '发送邮件',
              type: '远程',
              icon: 'Mail',
              endpoint: 'https://api.lantu.com/v1/email',
              description: 'SMTP 邮件发送服务'
            }, call.args);
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
      console.error('Gemini Error:', error);
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: '抱歉，处理您的请求时出现了错误。请检查 API 密钥配置。'
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
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">在线 • gemini-3-flash-preview</span>
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
            Powered by Gemini 3 Flash
          </p>
        </div>
      </div>
    </main>
  );
}

