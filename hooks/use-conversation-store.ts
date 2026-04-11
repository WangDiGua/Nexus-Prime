import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  tokensUsed: number;
  latencyMs: number;
  createdAt: Date;
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
      partialize: (state) => ({
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
