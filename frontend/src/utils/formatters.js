
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
