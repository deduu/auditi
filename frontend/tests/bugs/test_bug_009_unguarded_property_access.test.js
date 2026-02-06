/**
 * Bug #9: Unguarded property access in ConversationDetailPage.jsx
 *
 * Lines 241-249 access t.assistant.evaluation.status without optional
 * chaining. If any turn lacks assistant, evaluation, or status, this
 * throws a TypeError crashing the entire page.
 */
import { describe, it, expect } from 'vitest'

/**
 * Reproduce the vulnerable filter logic from ConversationDetailPage.jsx lines 241-249
 */
function vulnerableFilterCounts(turns) {
  const passCount = turns?.filter(
    (t) => t.assistant.evaluation.status === 'pass'
  ).length || 0
  const failCount = turns?.filter(
    (t) => t.assistant.evaluation.status === 'fail'
  ).length || 0
  const reviewCount = turns?.filter(
    (t) => t.assistant.evaluation.status === 'review'
  ).length || 0
  return { passCount, failCount, reviewCount }
}

/**
 * Fixed version with optional chaining
 */
function fixedFilterCounts(turns) {
  const passCount = turns?.filter(
    (t) => t?.assistant?.evaluation?.status === 'pass'
  ).length || 0
  const failCount = turns?.filter(
    (t) => t?.assistant?.evaluation?.status === 'fail'
  ).length || 0
  const reviewCount = turns?.filter(
    (t) => t?.assistant?.evaluation?.status === 'review'
  ).length || 0
  return { passCount, failCount, reviewCount }
}

describe('Bug #9: Unguarded property access crash', () => {
  it('crashes when turn has no assistant property', () => {
    const turns = [
      { user: { input: 'hello' } }, // no assistant property
    ]
    expect(() => vulnerableFilterCounts(turns)).toThrow(TypeError)
  })

  it('crashes when assistant has no evaluation property', () => {
    const turns = [
      { assistant: { output: 'hi' } }, // no evaluation property
    ]
    expect(() => vulnerableFilterCounts(turns)).toThrow(TypeError)
  })

  it('works with complete data', () => {
    const turns = [
      { assistant: { evaluation: { status: 'pass' } } },
      { assistant: { evaluation: { status: 'fail' } } },
      { assistant: { evaluation: { status: 'pass' } } },
    ]
    const result = vulnerableFilterCounts(turns)
    expect(result.passCount).toBe(2)
    expect(result.failCount).toBe(1)
    expect(result.reviewCount).toBe(0)
  })

  it('fixed version handles missing assistant', () => {
    const turns = [
      { user: { input: 'hello' } },
      { assistant: { evaluation: { status: 'pass' } } },
    ]
    const result = fixedFilterCounts(turns)
    expect(result.passCount).toBe(1)
    expect(result.failCount).toBe(0)
  })

  it('fixed version handles missing evaluation', () => {
    const turns = [
      { assistant: { output: 'hi' } },
      { assistant: { evaluation: { status: 'fail' } } },
    ]
    const result = fixedFilterCounts(turns)
    expect(result.failCount).toBe(1)
    expect(result.passCount).toBe(0)
  })

  it('fixed version handles null turns', () => {
    const result = fixedFilterCounts(null)
    expect(result.passCount).toBe(0)
    expect(result.failCount).toBe(0)
    expect(result.reviewCount).toBe(0)
  })
})
