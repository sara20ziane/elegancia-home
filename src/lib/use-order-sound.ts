import { useCallback, useEffect, useRef, useState } from "react";

/** Audio is opt-in, unlocked by a click, and never resumed from a background event. */
export function useOrderSound() {
  const context = useRef<AudioContext | null>(null);
  const mounted = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void context.current?.close().catch(() => {});
      context.current = null;
    };
  }, []);
  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    try {
      const audio = context.current ?? new AudioContext();
      context.current = audio;
      await audio.resume();
      if (mounted.current) {
        setEnabled(audio.state === "running");
        setUnavailable(audio.state !== "running");
      }
    } catch {
      if (mounted.current) setUnavailable(true);
    }
  };
  const play = useCallback(() => {
    const audio = context.current;
    if (!enabled || !audio || audio.state !== "running") return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.2);
    } catch {
      // Audio failure is independent of the visual notification.
    }
  }, [enabled]);
  return { enabled, unavailable, toggle, play };
}
