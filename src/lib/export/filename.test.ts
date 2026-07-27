import { describe, expect, it } from 'vitest'
import { resolveFilenameBase, todayAsFilenameBase } from './filename'

describe('resolveFilenameBase', () => {
  it('keeps a valid custom name as-is', () => {
    expect(resolveFilenameBase('내 계약서')).toBe('내 계약서')
  })

  it('falls back to today\'s date when left blank', () => {
    expect(resolveFilenameBase('')).toBe(todayAsFilenameBase())
  })

  it('falls back to today\'s date when only whitespace is entered', () => {
    expect(resolveFilenameBase('   ')).toBe(todayAsFilenameBase())
  })

  it('strips characters invalid in filenames', () => {
    expect(resolveFilenameBase('a/b:c*d?e"f<g>h|i\\j')).toBe('a b c d e f g h i j')
  })

  it('falls back to today\'s date when nothing usable remains after stripping', () => {
    expect(resolveFilenameBase('///')).toBe(todayAsFilenameBase())
  })

  it('collapses internal whitespace left by stripped characters', () => {
    expect(resolveFilenameBase('a  /  b')).toBe('a b')
  })
})

describe('todayAsFilenameBase', () => {
  it('formats a given date as yyyy-mm-dd', () => {
    expect(todayAsFilenameBase(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
