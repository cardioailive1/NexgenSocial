// A single shared AudioContext for the whole app.
//
// Browsers create AudioContexts suspended and refuse to start them without
// a user gesture. Creating one at the moment a sound is needed is too late
// -- that's the "An AudioContext was prevented from starting automatically"
// warning. Instead we create one context up front and resume it on the
// first real interaction, so by the time a call rings it's already allowed.
let ctx = null;
let listenersAttached = false;

function getContext() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

function resume() {
  const c = getContext();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// Call once at app start. Safe to call repeatedly.
export function installAudioUnlock() {
  if (listenersAttached) return;
  listenersAttached = true;
  const events = ["pointerdown", "keydown", "touchstart"];
  const handler = () => resume();
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
}

// Returns a ready-to-use context, or null if audio is still blocked. Callers
// should treat null as "stay silent" rather than an error -- visual cues
// carry the message either way.
export function getReadyContext() {
  const c = getContext();
  if (!c) return null;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
    return null;
  }
  return c;
}

// Plays a short two-tone ring. No-ops silently if audio isn't unlocked.
export function playRing(volume = 0.2) {
  const c = getReadyContext();
  if (!c) return false;
  try {
    [0, 0.4].forEach((offset) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = offset === 0 ? 480 : 620;
      gain.gain.setValueAtTime(0.0001, c.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + offset + 0.35);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + offset);
      osc.stop(c.currentTime + offset + 0.36);
    });
    return true;
  } catch {
    return false;
  }
}

// Single lower tone, used as the caller's ringback.
export function playRingback(volume = 0.12) {
  const c = getReadyContext();
  if (!c) return false;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = 420;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 1.05);
    return true;
  } catch {
    return false;
  }
}
