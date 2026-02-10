import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle, Info, AlertCircle, X, Volume2, VolumeX } from "lucide-react";

const icons = {
  success: CheckCircle,
  info: Info,
  error: AlertCircle,
};

const colorStyles = {
  success: {
    container: "bg-emerald-950/90 border-emerald-500/40",
    icon: "text-emerald-400 bg-emerald-500/20",
    title: "text-emerald-300",
    message: "text-emerald-200/80",
    progress: "bg-emerald-500",
  },
  info: {
    container: "bg-blue-950/90 border-blue-500/40",
    icon: "text-blue-400 bg-blue-500/20",
    title: "text-blue-300",
    message: "text-blue-200/80",
    progress: "bg-blue-500",
  },
  error: {
    container: "bg-red-950/90 border-red-500/40",
    icon: "text-red-400 bg-red-500/20",
    title: "text-red-300",
    message: "text-red-200/80",
    progress: "bg-red-500",
  },
};

const titles = {
  success: "Evaluation Complete",
  info: "Evaluation Updated",
  error: "Evaluation Failed",
};

// Generate a notification sound using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Pleasant two-tone chime
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);       // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);   // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Silently fail if audio isn't available
  }
}

// Persist preferences in localStorage
const SOUND_KEY = "auditi_eval_sound";
const NOTIFICATIONS_KEY = "auditi_eval_notifications";

function getSoundEnabled() {
  const stored = localStorage.getItem(SOUND_KEY);
  return stored === null ? true : stored === "true";
}

export function getNotificationsEnabled() {
  const stored = localStorage.getItem(NOTIFICATIONS_KEY);
  return stored === null ? true : stored === "true";
}

export function setNotificationsEnabled(val) {
  localStorage.setItem(NOTIFICATIONS_KEY, String(val));
}

export const Toast = ({ message, type = "success", duration = 6000, onClose }) => {
  const [visible, setVisible] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(getSoundEnabled);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  }, [onClose]);

  useEffect(() => {
    if (soundEnabled) playNotificationSound();
  }, []); // Play once on mount

  useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, dismiss]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, String(next));
  };

  const Icon = icons[type] || icons.info;
  const colors = colorStyles[type] || colorStyles.info;
  const title = titles[type] || titles.info;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 w-80 rounded-xl border shadow-2xl backdrop-blur-sm
        transition-all duration-300 overflow-hidden
        ${visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"}
        ${colors.container}`}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${colors.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${colors.title}`}>{title}</p>
            <p className={`text-sm mt-0.5 ${colors.message}`}>{message}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleSound}
              className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity text-slate-400"
              title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={dismiss}
              className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className={`h-full ${colors.progress} opacity-60`}
          style={{
            animation: `shrink ${duration}ms linear forwards`,
          }}
        />
      </div>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
