import assert from 'node:assert/strict'
import test from 'node:test'

import { extractImageSources, extractLastImageSource } from '../src/utils/message'

test('extractImageSources returns all images in order', () => {
  const content = '<img src="https://example.com/1.jpg" file="1.jpg"/>text<img src="https://example.com/2.png" file="2.png"/>'

  const result = extractImageSources(content)

  assert.deepEqual(result, [
    { src: 'https://example.com/1.jpg', file: '1.jpg' },
    { src: 'https://example.com/2.png', file: '2.png' },
  ])
})

test('extractLastImageSource keeps backward compatibility', () => {
  const content = '<img src="https://example.com/1.jpg" file="1.jpg"/><img src="https://example.com/2.png" file="2.png"/>'

  assert.deepEqual(extractLastImageSource(content), {
    src: 'https://example.com/2.png',
    file: '2.png',
  })
})
