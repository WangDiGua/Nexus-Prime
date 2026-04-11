/** 与 ThemeContext、内联脚本共用，避免首屏亮色闪烁与逻辑分叉 */

export const THEME_STORAGE_KEY = 'nexus-theme';

export type StoredTheme = 'LIGHT' | 'DARK' | 'SYSTEM';

export type ResolvedTheme = 'light' | 'dark';

export function resolveStoredTheme(
  stored: StoredTheme | null,
): ResolvedTheme {
  if (stored === 'LIGHT') return 'light';
  if (stored === 'DARK') return 'dark';
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function readThemePreferenceFromStorage(): StoredTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'LIGHT' || raw === 'DARK' || raw === 'SYSTEM') {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 注入到 layout 的阻塞脚本（字符串须与上方逻辑一致）。
 * 在首帧绘制前为 documentElement 打上 light/dark，避免 FOUC。
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var r;if(t==='LIGHT')r='light';else if(t==='DARK')r='dark';else r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);}catch(e){}})();`;
