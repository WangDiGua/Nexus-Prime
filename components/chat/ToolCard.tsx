'use client';

import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  toolName: string;
  args: Record<string, unknown>;
  status: 'calling' | 'success' | 'error';
  latency?: string;
  endpoint?: string;
  result?: unknown;
  error?: string;
  onRetry?: () => void;
}

export default function ToolCard({
  toolName,
  args,
  status,
  latency = '0ms',
  endpoint = '/invoke',
  result,
  error,
}: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'calling') {
      interval = setInterval(() => {
        setTimer(prev => prev + 10);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTimer = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "my-4 ios-card overflow-hidden transition-all duration-300 w-full",
        status === 'calling' && "ring-2 ring-primary/20",
        status === 'error' && "ring-2 ring-ios-red/20"
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            status === 'calling' && "bg-primary/10 text-primary animate-pulse",
            status === 'success' && "bg-ios-green/10 text-ios-green",
            status === 'error' && "bg-ios-red/10 text-ios-red"
          )}>
            <Zap size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">{toolName}</h4>
            <p className="text-[9px] text-muted-foreground font-mono truncate max-w-[200px]">{endpoint}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Clock size={10} />
            {status === 'calling' ? formatTimer(timer) : latency}
          </div>
          {status === 'calling' && <Loader2 size={12} className="text-primary animate-spin" />}
          {status === 'success' && <CheckCircle2 size={12} className="text-ios-green" />}
          {status === 'error' && <XCircle size={12} className="text-ios-red" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">调用参数</span>
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-zinc-800/50 font-mono text-[10px]">
            <pre className="text-primary/80 overflow-x-auto">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && status !== 'calling' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  {status === 'error' ? '错误信息' : '响应结果'}
                </span>
                <div className={cn(
                  "p-3 rounded-xl font-mono text-[10px] border",
                  status === 'success' ? "bg-ios-green/5 border-ios-green/10 text-foreground" : "bg-ios-red/5 border-ios-red/10 text-ios-red"
                )}>
                  <pre className="overflow-x-auto">
                    {status === 'error' 
                      ? JSON.stringify({ error: error || 'Unknown error' }, null, 2)
                      : JSON.stringify(result ?? { data: null }, null, 2)
                    }
                  </pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(status === 'error' || status === 'success') && (
        <div className="px-4 py-2.5 bg-zinc-50/50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              status === 'success' ? "bg-ios-green" : "bg-ios-red"
            )} />
            <span className="text-[9px] text-muted-foreground uppercase font-bold">
              {status === 'success' ? '执行成功' : '执行失败'}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
