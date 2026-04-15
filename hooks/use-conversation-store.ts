'use client';

import { create } from 'zustand';

export interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

interface ConversationState {
  conversationListNonce: number;
  conversations: Conversation[];
  bootstrapReady: boolean;
  bumpConversationList: () => void;
  setConversations: (conversations: Conversation[]) => void;
}

export const useConversationStore = create<ConversationState>()((set) => ({
  conversationListNonce: 0,
  conversations: [],
  bootstrapReady: false,
  bumpConversationList: () =>
    set((state) => ({
      conversationListNonce: state.conversationListNonce + 1,
    })),
  setConversations: (conversations) => set({ conversations, bootstrapReady: true }),
}));
