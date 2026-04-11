import * as React from "react"

/** 与 Tailwind `md` 对齐：&lt; md 视为移动端布局 */
export const MOBILE_BREAKPOINT = 768

function subscribeMobile(cb: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

function getMobileSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

/** SSR 与首帧与桌面布局一致，避免 hydration 报错 */
function getMobileServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getMobileServerSnapshot
  )
}
