import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createStore, del, get, set } from 'idb-keyval';

const DB_NAME = 'nexus-prime';
const STORE_NAME = 'conversation-persist';

/** 专用于会话 zustand persist 的 IndexedDB 对象库 */
const idbStore = createStore(DB_NAME, STORE_NAME);

function canUseIndexedDB(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof indexedDB !== 'undefined'
  );
}

/**
 * Zustand persist 用的 StateStorage：底层为 IndexedDB（异步、大容量），
 * 首次读取若 IDB 无数据则尝试从 legacy localStorage 迁移并删除旧键。
 */
const idbStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!canUseIndexedDB()) return null;
    try {
      const raw = await get<string>(name, idbStore);
      if (raw !== undefined && raw !== null) {
        return typeof raw === 'string' ? raw : String(raw);
      }
    } catch {
      // IDB 不可用时回退
    }
    if (typeof localStorage !== 'undefined') {
      const legacy = localStorage.getItem(name);
      if (legacy !== null) {
        try {
          if (canUseIndexedDB()) await set(name, legacy, idbStore);
        } catch {
          /* ignore */
        }
        localStorage.removeItem(name);
        return legacy;
      }
    }
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!canUseIndexedDB()) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(name, value);
      }
      return;
    }
    await set(name, value, idbStore);
  },
  removeItem: async (name: string): Promise<void> => {
    if (canUseIndexedDB()) {
      try {
        await del(name, idbStore);
      } catch {
        /* ignore */
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(name);
    }
  },
};

/** 供 persist 使用的 JSON 存储（序列化逻辑与默认 localStorage 一致，底层为 IndexedDB） */
export const nexusConversationPersistStorage =
  createJSONStorage(() => idbStateStorage);
