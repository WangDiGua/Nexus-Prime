'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Trash2, 
  MoreHorizontal,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';

export interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

interface ConversationListProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  /** `full`: 新建 + 搜索 · `searchOnly`: 仅搜索 · `hidden`: 均不显示（由父级提供新建等） */
  toolbarVariant?: 'full' | 'searchOnly' | 'hidden';
  /** Tighter rows, single-line titles — ChatGPT-style history */
  density?: 'default' | 'compact';
  /** 未登录时不请求会话列表 */
  authenticated?: boolean;
}

export default function ConversationList({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  toolbarVariant = 'full',
  density = 'default',
  authenticated = true,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    fetchConversations();
  }, [authenticated]);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchConversations();
      return;
    }
    try {
      const response = await fetch(`/api/conversations?search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to search conversations:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          onNewConversation();
        }
        toast.success('会话已删除');
      } else {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('删除失败');
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  const compact = density === 'compact';
  const showNew = toolbarVariant === 'full';
  const showSearch = toolbarVariant === 'full' || toolbarVariant === 'searchOnly';

  return (
    <div className="flex flex-col h-full min-h-0">
      {toolbarVariant !== 'hidden' && (
        <div
          className={cn(
            'shrink-0 space-y-3',
            toolbarVariant === 'full' ? 'p-4' : 'px-3 pb-2 pt-0'
          )}
        >
          {showNew && (
            <button
              onClick={onNewConversation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Plus size={16} />
              新建会话
            </button>
          )}

          {showSearch && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索会话..."
                className={cn(
                  'w-full rounded-xl py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/20',
                  compact
                    ? 'border border-transparent bg-black/[0.04] dark:bg-white/[0.05]'
                    : 'bg-[#f4f4f4] dark:bg-[#2f2f2f]'
                )}
              />
            </div>
          )}
        </div>
      )}

      <ScrollArea className={cn('flex-1 min-h-0', compact ? 'px-2' : 'px-2')}>
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/10" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare size={32} className="opacity-30 mb-3" />
            <p className="text-sm">暂无会话</p>
            <p className="text-xs opacity-60 mt-1">开始新对话吧</p>
          </div>
        ) : (
          <div className={cn('space-y-0.5', compact ? 'p-1' : 'p-2')}>
            <AnimatePresence>
              {conversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "group relative cursor-pointer transition-colors rounded-lg",
                    compact ? "px-3 py-2.5" : "p-3 rounded-xl",
                    activeConversationId === conv.id
                      ? compact
                        ? "bg-white/10 text-foreground"
                        : "bg-primary/10 border border-primary/20"
                      : compact
                        ? "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                        : "hover:bg-[#ececec] dark:hover:bg-white/[0.05]"
                  )}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div className={cn("flex", compact ? "items-center gap-2" : "items-start gap-3")}>
                    {!compact && (
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        activeConversationId === conv.id
                          ? "bg-primary/20 text-primary"
                          : "bg-[#ececec] text-muted-foreground dark:bg-[#2f2f2f]"
                      )}>
                        <MessageSquare size={14} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "font-medium text-foreground truncate",
                        compact ? "text-[13px]" : "text-sm"
                      )}>
                        {conv.title || '新会话'}
                      </h4>
                      {!compact && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {conv.messageCount} 条消息
                          </span>
                          {conv.lastMessageAt && (
                            <>
                              <span className="text-[10px] text-muted-foreground/50">•</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock size={8} />
                                {formatTime(conv.lastMessageAt)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(showDeleteConfirm === conv.id ? null : conv.id);
                      }}
                      className={cn(
                        "p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all shrink-0",
                        compact ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showDeleteConfirm === conv.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 flex items-center gap-2 border-t border-gpt-border pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(conv.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 size={12} />
                            确认删除
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(null);
                            }}
                            className="flex-1 rounded-lg bg-[#ececec] px-2 py-1.5 text-xs font-medium transition-colors hover:bg-[#e0e0e0] dark:bg-[#2f2f2f] dark:hover:bg-[#3b3b3b]"
                          >
                            取消
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
