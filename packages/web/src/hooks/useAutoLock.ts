import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

/** Mounts once at the app root. Locks the vault after `autoLockMinutes` of inactivity, checked every 10s. */
export function useAutoLock(): void {
  const isUnlocked = useAuthStore((s) => s.isUnlocked);
  const autoLockMinutes = useAuthStore((s) => s.autoLockMinutes);
  const touchActivity = useAuthStore((s) => s.touchActivity);
  const lock = useAuthStore((s) => s.lock);

  useEffect(() => {
    const handler = () => touchActivity();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handler));
  }, [touchActivity]);

  useEffect(() => {
    if (!isUnlocked || autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      const lastActivityAt = useAuthStore.getState().lastActivityAt;
      const elapsedMinutes = (Date.now() - lastActivityAt) / 60_000;
      if (elapsedMinutes >= autoLockMinutes) {
        lock("timeout");
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [isUnlocked, autoLockMinutes, lock]);

  // Lock immediately when the tab/window is closed or hidden for a long
  // time — also lock on visibility change after the threshold, so
  // switching away and back doesn't leave the vault open indefinitely.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        touchActivity(); // record the moment we lost focus, used as the inactivity baseline
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [touchActivity]);

  // Desktop-only: Electron's preload bridge forwards OS power events
  // (system sleep, screen lock) that a browser tab simply cannot observe.
  // `window.axisvault` is undefined on web, so this is a no-op there —
  // the SAME lock() action handles both triggers, keeping the lock logic
  // itself fully shared between platforms.
  useEffect(() => {
    if (!window.axisvault) return;
    const unsubscribe = window.axisvault.onForceLock((reason) => {
      lock(reason === "system-suspend" ? "timeout" : "manual");
    });
    return unsubscribe;
  }, [lock]);
}
