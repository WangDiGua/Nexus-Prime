'use client';

import { useSyncExternalStore } from 'react';

type ThemeListener = () => void;

let currentIsDark = false;
let observerStarted = false;
let rootObserver: MutationObserver | null = null;
const listeners = new Set<ThemeListener>();

function readIsDark() {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.documentElement.classList.contains('dark');
}

function emitThemeChange() {
  currentIsDark = readIsDark();
  for (const listener of listeners) {
    listener();
  }
}

function ensureThemeObserver() {
  if (observerStarted || typeof document === 'undefined') {
    return;
  }

  observerStarted = true;
  currentIsDark = readIsDark();

  rootObserver = new MutationObserver(() => {
    const nextIsDark = readIsDark();
    if (nextIsDark === currentIsDark) {
      return;
    }
    emitThemeChange();
  });

  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

function subscribe(listener: ThemeListener) {
  ensureThemeObserver();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && rootObserver) {
      rootObserver.disconnect();
      rootObserver = null;
      observerStarted = false;
    }
  };
}

function getSnapshot() {
  ensureThemeObserver();
  return currentIsDark;
}

function getServerSnapshot() {
  return false;
}

export function useDarkMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
