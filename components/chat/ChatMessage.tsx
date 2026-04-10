'use client';

import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Message } from 'ai';
import ToolCard from './ToolCard';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3 max-w-3xl mx-auto w-full animate-ios-fade-in",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
          <Bot size={16} />
        </div>
      )}

      <div className={cn(
        "flex flex-col gap-1.5 flex-1",
        isUser ? "items-end" : "items-start"
      )}>
        {message.content && (
          <div className={cn(
            "px-4 py-2.5 rounded-[20px] text-sm leading-relaxed shadow-sm",
            isUser 
              ? "bg-primary text-white rounded-tr-[4px]" 
              : "bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-tl-[4px]"
          )}>
            <div className={cn(
              "prose prose-sm max-w-none",
              isUser ? "prose-invert" : "dark:prose-invert"
            )}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {message.toolInvocations?.map((toolInvocation) => {
          const { toolName, toolCallId, state } = toolInvocation;

          if (state === 'result') {
            return (
              <div key={toolCallId} className="w-full mt-2">
                <ToolCard 
                  toolName={toolName}
                  args={toolInvocation.args}
                  status="success"
                  result={toolInvocation.result}
                  latency="自动计算"
                  endpoint={`/api/chat#${toolName}`}
                />
              </div>
            );
          }

          return (
            <div key={toolCallId} className="w-full mt-2">
              <ToolCard 
                toolName={toolName}
                args={toolInvocation.args}
                status="calling"
                endpoint={`/api/chat#${toolName}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
