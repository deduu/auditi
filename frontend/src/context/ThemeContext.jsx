import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = {
  original: {
    id: 'original',
    name: 'Original Dark',
    description: 'The default dark theme',
    colorScheme: 'dark',
    preview: { bg: '#020617', surface: '#0f172a', text: '#f8fafc', accent: '#3b82f6' },
  },
  'neutral-light': {
    id: 'neutral-light',
    name: 'Neutral Light',
    description: 'Clean, professional light theme',
    colorScheme: 'light',
    preview: { bg: '#ffffff', surface: '#f8fafc', text: '#0f172a', accent: '#3b82f6' },
  },
  'soft-light': {
    id: 'soft-light',
    name: 'Soft Light',
    description: 'Warm, gentle tones',
    colorScheme: 'light',
    preview: { bg: '#fffbf5', surface: '#faf8f5', text: '#1c1917', accent: '#3b82f6' },
  },
  monochrome: {
    id: 'monochrome',
    name: 'Monochrome Minimal',
    description: 'Pure B&W, high contrast',
    colorScheme: 'light',
    preview: { bg: '#ffffff', surface: '#fafafa', text: '#0a0a0a', accent: '#3b82f6' },
  },
  'low-contrast': {
    id: 'low-contrast',
    name: 'Low-Contrast Light',
    description: 'Easy on the eyes, reduced contrast',
    colorScheme: 'light',
    preview: { bg: '#f9fafb', surface: '#f3f4f6', text: '#374151', accent: '#3b82f6' },
  },
  'gray-based': {
    id: 'gray-based',
    name: 'Gray-Based Light',
    description: 'Gray foundation, not white',
    colorScheme: 'light',
    preview: { bg: '#e5e7eb', surface: '#eef0f3', text: '#111827', accent: '#3b82f6' },
  },
};

const STORAGE_KEY = 'auditi_theme';

const ThemeContext = createContext({
  theme: 'original',
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && THEMES[stored] ? stored : 'original';
    } catch {
      return 'original';
    }
  });

  const setTheme = (id) => {
    if (!THEMES[id]) return;
    setThemeState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'original') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    root.style.colorScheme = THEMES[theme].colorScheme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
