import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildGuildUserDir,
  buildGuildUserImagePath,
  buildTempImagePath,
} from '../src/utils/files'

test('path helpers compose guild and temp image paths', () => {
  assert.equal(
    buildGuildUserDir('/data/root', 'guild-1', 'user-2'),
    '/data/root/guild-1/user-2',
  )
  assert.equal(
    buildGuildUserImagePath('/data/root', 'guild-1', 'user-2', 'foo.jpg'),
    '/data/root/guild-1/user-2/foo.jpg',
  )
  assert.equal(
    buildTempImagePath('/data/root/tmp', 'foo.jpg'),
    '/data/root/tmp/foo.jpg',
  )
})
