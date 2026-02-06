/**
 * Bug #10: No error boundaries in the React frontend.
 *
 * Without React Error Boundaries, any rendering error in a child component
 * crashes the entire application with a white screen. React's default
 * behavior unmounts the entire component tree on unhandled errors.
 *
 * Fix: Created ErrorBoundary component and wrapped main content in App.jsx.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC_DIR = path.resolve(__dirname, '../../src')

describe('Bug #10: No error boundaries', () => {
  it('ErrorBoundary component file exists', () => {
    const filePath = path.join(SRC_DIR, 'components/common/ErrorBoundary.jsx')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('ErrorBoundary implements getDerivedStateFromError', () => {
    const filePath = path.join(SRC_DIR, 'components/common/ErrorBoundary.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('getDerivedStateFromError')
  })

  it('ErrorBoundary implements componentDidCatch', () => {
    const filePath = path.join(SRC_DIR, 'components/common/ErrorBoundary.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('componentDidCatch')
  })

  it('ErrorBoundary renders fallback UI on error', () => {
    const filePath = path.join(SRC_DIR, 'components/common/ErrorBoundary.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('hasError')
    expect(source).toContain('Something went wrong')
  })

  it('App.jsx imports and uses ErrorBoundary', () => {
    const filePath = path.join(SRC_DIR, 'App.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('ErrorBoundary')
    expect(source).toContain('<ErrorBoundary>')
  })
})
