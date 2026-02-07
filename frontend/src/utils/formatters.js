import { format } from "date-fns";

/**
 * Parse a datetime string from the API, treating naive timestamps as UTC.
 * If the string has no timezone indicator (no Z, no +/-offset), appends 'Z'.
 */
export function parseUTCDate(dateString) {
  if (!dateString) return null;
  const s = String(dateString);
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s + "Z");
}

/**
 * Format a datetime string from the API using date-fns.
 * Treats naive timestamps as UTC, then displays in local timezone.
 */
export function formatDateTime(dateString, fmt = "PPpp") {
  const date = parseUTCDate(dateString);
  if (!date || isNaN(date.getTime())) return "N/A";
  return format(date, fmt);
}

/**
 * Format a datetime string as locale date only.
 */
export function formatDate(dateString) {
  const date = parseUTCDate(dateString);
  if (!date || isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

/**
 * Format a timestamp for detailed display (with timezone name).
 */
export function formatTimestamp(dateString) {
  const date = parseUTCDate(dateString);
  if (!date || isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    timeZoneName: "short",
  });
}

export const formatLatency = (seconds) => {
  if (typeof seconds !== 'number') return '0s';
  
  if (seconds < 1) {
    return `${seconds.toFixed(3)}s`;
  } else if (seconds >= 1 && seconds < 10) {
    return `${seconds.toFixed(2)}s`;
  } else {
    // > 10s
    return `${seconds.toFixed(1)}s`;
  }
};

export const formatScore = (score) => {
  if (typeof score !== 'number') return '0.00';
  // "Show max 2 decimal places" - usually means up to 2, but examples show 2.
  // "0.65", "0.72", "0.91".
  // If user meant "up to", 1 would be 1. But consistency is usually better.
  // Examples provided: 0.65, 0.72, 0.91.
  // I will use toFixed(2) to ensure consistent alignment.
  return score.toFixed(2);
};
