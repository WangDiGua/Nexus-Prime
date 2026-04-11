import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nexusConversationPersistStorage } from '@/lib/nexus-idb-persist-storage';

export interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  toolCalls: Record<string, unknown> | null;
  toolResults: Record<string, unknown> | null;
  thinkingLog: string[] | null;
  thinkingStepDurationsMs?: number[] | null;
  tokensUsed: number;
  latencyMs: number;
  createdAt: Date;
}

function normalizeMessageDates(messages: Message[]): Message[] {
  return messages.map((m) => ({
    ...m,
    createdAt:
      m.createdAt instanceof Date
        ? m.createdAt
        : new Date(m.createdAt as unknown as string),
  }));
}

interface ConversationState {
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set) => ({
      activeConversationId: null,
      messages: [],
      isLoading: false,

      setActiveConversation: (id) => set({ activeConversationId: id }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      clearMessages: () => set({ messages: [] }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'nexus-conversation',
      /** 使用 IndexedDB（idb-keyval）持久化，避免 localStorage 同步写与容量限制 */
      storage: nexusConversationPersistStorage,
      /**
       * v2: 曾错误跳过服务端恢复，迁移清空 messages。
       * v3: 持久化当前会话 messages（浏览器一级缓存），进入时先展示本地，再后台对齐数据库。
       * v4: 存储后端改为 IndexedDB；首次仍可从同名的 legacy localStorage 键迁移（见 nexus-idb-persist-storage）。
       */
      version: 4,
      migrate: (persistedState, version) => {
        const s = persistedState as Partial<ConversationState> | null | undefined;
        if (!s || typeof s !== 'object') return persistedState;
        if (version < 2) {
          return { ...s, messages: [], isLoading: false };
        }
        if (version < 3) {
          return { ...s, messages: [], isLoading: false };
        }
        return persistedState;
      },
      partialize: (state) => ({
        activeConversationId: state.activeConversationId,
        messages: state.messages,
      }),
      merge: (persistedState, currentState) => {
        const p = persistedState as Partial<ConversationState> | undefined;
        const c = currentState as ConversationState;
        if (!p) return c;
        return {
          ...c,
          ...p,
          messages: normalizeMessageDates(p.messages ?? []),
          isLoading: false,
        };
      },
    }
  )
);
