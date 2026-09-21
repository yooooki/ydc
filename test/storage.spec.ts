import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'

import { getImagePathsFromFullPath } from '../src/utils/files'
import { formatTimestampFolderName } from '../src/utils/time'

test('formatTimestampFolderName formats local date and time', () => {
  const date = new Date(2026, 3, 14, 12, 34, 56)
  assert.equal(formatTimestampFolderName(date), '20260414-123456')
})

test('getImagePathsFromFullPath handles both single file and folder', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ydc-storage-'))

  // 旧版单文件
  const single = path.join(dataDir, 'old.jpg')
  await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).jpeg().toFile(single)

  // 新版多图文件夹
  const folder = path.join(dataDir, '20260414-123456')
  await fs.mkdir(folder)
  await sharp({ create: { width: 1, height: 1, channels: 3, background: '#f00' } }).jpeg().toFile(path.join(folder, '0.jpg'))
  await sharp({ create: { width: 1, height: 1, channels: 3, background: '#0f0' } }).png().toFile(path.join(folder, '1.png'))

  assert.deepEqual(getImagePathsFromFullPath(single), [single])
  assert.deepEqual(getImagePathsFromFullPath(folder), [
    path.join(folder, '0.jpg'),
    path.join(folder, '1.png'),
  ])

  await fs.rm(dataDir, { recursive: true, force: true })
})
