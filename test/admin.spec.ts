import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAcceptArgs } from '../src/utils/argv'

test('parseAcceptArgs expands integers and ranges', () => {
  const result = parseAcceptArgs(['1', '3-5', '8'])

  assert.deepEqual(result.values, [1, 3, 4, 5, 8])
  assert.equal(result.errorMessage, '')
})

test('parseAcceptArgs reports invalid and reverse ranges', () => {
  const result = parseAcceptArgs(['2-1', 'a-b', '7'])

  assert.deepEqual(result.values, [7])
  assert.match(result.errorMessage, /2-1/)
  assert.match(result.errorMessage, /a-b/)
})
