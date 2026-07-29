import { useEffect } from "react";

const STORAGE_KEY = "ngs_screentime";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function readScreenTime() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeScreenTime(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Tracks active (tab-focused) seconds per day, entirely in the browser.
// Nothing here is sent to the server or used for ad targeting -- it exists
// only so the person can see their own usage, which most platforms simply
// don't expose at all.
export function useScreenTime() {
  useEffect(() => {
    let interval = null;

    function tick() {
      const data = readScreenTime();
      const key = todayKey();
      data[key] = (data[key] || 0) + 1;
      writeScreenTime(data);
    }

    function start() {
      if (interval) return;
      interval = setInterval(tick, 1000);
    }
    function stop() {
      if (interval) clearInterval(interval);
      interval = null;
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") start();
      else stop();
    });
    window.addEventListener("blur", stop);
    window.addEventListener("focus", start);

    return () => stop();
  }, []);
}
