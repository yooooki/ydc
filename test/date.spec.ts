import assert from 'node:assert/strict'
import test from 'node:test'

import { parseDateRange } from '../src/utils/time'

test('parseDateRange parses a single day', () => {
  const range = parseDateRange('2026-04-01')
  assert.ok(range)
  assert.equal(range.start.getFullYear(), 2026)
  assert.equal(range.start.getMonth(), 3)
  assert.equal(range.start.getDate(), 1)
  assert.equal(range.end.getTime() - range.start.getTime(), 24 * 60 * 60 * 1000)
})

test('parseDateRange parses a start~end range', () => {
  const range = parseDateRange('2026-04-01~2026-04-10')
  assert.ok(range)
  assert.equal(range.end.getTime() - range.start.getTime(), 9 * 24 * 60 * 60 * 1000)
})

test('parseDateRange rejects invalid input', () => {
  assert.equal(parseDateRange(''), null)
  assert.equal(parseDateRange('not-a-date'), null)
})
