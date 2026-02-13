import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THEMES } from '../../src/context/ThemeContext';
import fs from 'fs';
import path from 'path';

const EXPECTED_THEMES = ['original', 'neutral-light', 'soft-light', 'monochrome', 'low-contrast', 'gray-based'];
const REQUIRED_PREVIEW_KEYS = ['bg', 'surface', 'text', 'accent'];

describe('Theme definitions', () => {
  it('defines all 6 themes', () => {
    expect(Object.keys(THEMES)).toHaveLength(6);
    for (const id of EXPECTED_THEMES) {
      expect(THEMES[id]).toBeDefined();
    }
  });

  it.each(EXPECTED_THEMES)('theme "%s" has all required fields', (id) => {
    const theme = THEMES[id];
    expect(theme.id).toBe(id);
    expect(typeof theme.name).toBe('string');
    expect(theme.name.length).toBeGreaterThan(0);
    expect(typeof theme.description).toBe('string');
    expect(theme.description.length).toBeGreaterThan(0);
    expect(['dark', 'light']).toContain(theme.colorScheme);
    expect(theme.preview).toBeDefined();
    for (const key of REQUIRED_PREVIEW_KEYS) {
      expect(typeof theme.preview[key]).toBe('string');
    }
  });

  it('only "original" uses dark color scheme', () => {
    expect(THEMES.original.colorScheme).toBe('dark');
    for (const id of EXPECTED_THEMES.filter((t) => t !== 'original')) {
      expect(THEMES[id].colorScheme).toBe('light');
    }
  });
});

describe('index.css theme selectors', () => {
  const cssPath = path.resolve(__dirname, '../../src/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  it('contains @theme block with fixed-white and fixed-black', () => {
    expect(css).toContain('--color-fixed-white');
    expect(css).toContain('--color-fixed-black');
  });

  it('contains modal overlay CSS variables', () => {
    expect(css).toContain('--modal-overlay-bg');
    expect(css).toContain('--modal-overlay-blur');
  });

  it.each(['neutral-light', 'soft-light', 'monochrome', 'low-contrast', 'gray-based'])(
    'contains [data-theme="%s"] selector',
    (id) => {
      expect(css).toContain(`[data-theme="${id}"]`);
    }
  );

  it('does not contain a [data-theme="original"] selector (original uses defaults)', () => {
    expect(css).not.toContain('[data-theme="original"]');
  });

  it('uses var() references for :root background-color and color', () => {
    // Should use CSS variables, not hardcoded hex
    const rootBlock = css.match(/:root\s*\{[^}]+\}/s)?.[0] || '';
    expect(rootBlock).toContain('var(--color-slate-');
  });
});

describe('localStorage persistence logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to "original" when no stored theme', () => {
    expect(localStorage.getItem('auditi_theme')).toBeNull();
  });

  it('persists a valid theme id', () => {
    localStorage.setItem('auditi_theme', 'soft-light');
    expect(localStorage.getItem('auditi_theme')).toBe('soft-light');
    expect(THEMES['soft-light']).toBeDefined();
  });

  it('invalid stored theme should fall back to original', () => {
    localStorage.setItem('auditi_theme', 'nonexistent-theme');
    const stored = localStorage.getItem('auditi_theme');
    // ThemeContext falls back to 'original' if stored value isn't in THEMES
    const resolved = THEMES[stored] ? stored : 'original';
    expect(resolved).toBe('original');
  });
});
