/** 与 ThemeContext、内联脚本共用，避免首屏亮色闪烁与逻辑分叉 */

export const THEME_STORAGE_KEY = 'nexus-theme';

export type StoredTheme = 'LIGHT' | 'DARK' | 'SYSTEM';

export type ResolvedTheme = 'light' | 'dark';

/** Cookie 与 localStorage 同名，供 SSR 首屏 class 与 boot 脚本同步 */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

export function cookieStringForTheme(theme: StoredTheme): string {
  return `${THEME_STORAGE_KEY}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};SameSite=Lax`;
}

/**
 * SSR：Cookie 为 LIGHT/DARK 时可直接给 html 加 class，避免首屏白底。
 * SYSTEM 或未设置时返回 null，由 Sec-CH 或客户端脚本决定。
 */
export function themeClassFromCookie(
  cookieValue: string | undefined,
): 'light' | 'dark' | null {
  if (cookieValue === 'LIGHT') return 'light';
  if (cookieValue === 'DARK') return 'dark';
  return null;
}

/**
 * Sec-CH-Prefers-Color-Scheme（需响应里带 Accept-CH，见 next.config）
 */
export function themeClassFromClientHint(
  hint: string | null,
): 'light' | 'dark' | null {
  if (hint === 'dark') return 'dark';
  if (hint === 'light') return 'light';
  return null;
}

const MAX_AGE = String(THEME_COOKIE_MAX_AGE);

/**
 * 在首帧 CSS 加载前同步 class + 背景色 + color-scheme，并回写 Cookie，
 * 减轻「先白后暗」FOUC。
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var r;if(t==='LIGHT')r='light';else if(t==='DARK')r='dark';else r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var el=document.documentElement;el.classList.remove('light','dark');el.classList.add(r);el.style.colorScheme=r;var bg=r==='dark'?'#212121':'#ffffff';el.style.backgroundColor=bg;if(document.body)document.body.style.backgroundColor=bg;document.cookie=k+'='+(t||'SYSTEM')+';path=/;max-age=${MAX_AGE};SameSite=Lax';}catch(e){}})();`;
