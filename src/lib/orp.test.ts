import { describe, expect, it } from 'vitest'
import { orpIndex } from './orp'

describe('orpIndex', () => {
  it('uses letter 1 for length 1', () => {
    expect(orpIndex(1)).toBe(0)
  })

  it('uses letter 2 for lengths 2 to 5', () => {
    expect(orpIndex(2)).toBe(1)
    expect(orpIndex(5)).toBe(1)
  })

  it('uses letter 3 for lengths 6 to 9', () => {
    expect(orpIndex(6)).toBe(2)
    expect(orpIndex(9)).toBe(2)
  })

  it('uses letter 4 for lengths 10 to 13', () => {
    expect(orpIndex(10)).toBe(3)
    expect(orpIndex(13)).toBe(3)
  })

  it('uses letter 5 for length 14 and more', () => {
    expect(orpIndex(14)).toBe(4)
    expect(orpIndex(20)).toBe(4)
  })
})
