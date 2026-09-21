import assert from 'node:assert/strict'
import test from 'node:test'

import { createRuntime, getGuildLock, setGuildLock } from '../src/runtime'

test('guild locks are isolated per guild', () => {
  const runtime = createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir: 'ydc_files',
    smallReply: false,
    csmScopeDefault: 'guild',
    recordImageMode: 'last',
  })

  assert.equal(getGuildLock(runtime.state.locks.ydc, 'guild-a'), false)
  setGuildLock(runtime.state.locks.ydc, 'guild-a', true)

  assert.equal(getGuildLock(runtime.state.locks.ydc, 'guild-a'), true)
  assert.equal(getGuildLock(runtime.state.locks.ydc, 'guild-b'), false)
})
