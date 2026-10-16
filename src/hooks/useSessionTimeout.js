import { useEffect, useRef } from 'react'

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel', 'click']
const RESET_THROTTLE_MS = 1000
const WATCHDOG_INTERVAL_MS = 30000

export default function useSessionTimeout({
  enabled,
  timeoutMs = INACTIVITY_TIMEOUT_MS,
  onTimeout,
}) {
  const lastActivityRef = useRef(Date.now())
  const timerRef = useRef(null)
  const watchdogRef = useRef(null)
  const firedRef = useRef(false)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    firedRef.current = false
    lastActivityRef.current = Date.now()

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function fire() {
      if (firedRef.current) return
      firedRef.current = true
      clearTimer()
      if (typeof onTimeoutRef.current === 'function') {
        onTimeoutRef.current()
      }
    }

    function schedule() {
      clearTimer()
      timerRef.current = setTimeout(() => {
        if (Date.now() - lastActivityRef.current >= timeoutMs) {
          fire()
        } else {
          schedule()
        }
      }, timeoutMs)
    }

    function handleActivity() {
      const now = Date.now()
      if (now - lastActivityRef.current < RESET_THROTTLE_MS) return
      lastActivityRef.current = now
      if (!firedRef.current) {
        schedule()
      }
    }

    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        fire()
      } else {
        schedule()
      }
    }

    function watchdog() {
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        fire()
      }
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    )
    document.addEventListener('visibilitychange', handleVisibility)
    watchdogRef.current = setInterval(watchdog, WATCHDOG_INTERVAL_MS)
    schedule()

    return () => {
      clearTimer()
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current)
        watchdogRef.current = null
      }
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, timeoutMs])
}
