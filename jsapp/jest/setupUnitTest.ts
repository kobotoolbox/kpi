// Polyfill global fetch (for Node 20 and older)
import 'whatwg-fetch'
import { TextDecoder, TextEncoder } from 'util'
import { ReadableStream, TransformStream, WritableStream } from 'stream/web'

import chai from 'chai'
import $ from 'jquery'

// React Router v7 expects these globals in the test runtime.
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true })
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true })

// MSW now uses Web Streams for SSE/WebSocket internals.
// jsdom does not always expose these globals, so we provide them from Node.
// This prevents runtime errors like "WritableStream is not defined".
if (typeof globalThis.WritableStream === 'undefined') {
  Object.defineProperty(globalThis, 'WritableStream', { value: WritableStream, configurable: true })
}

if (typeof globalThis.ReadableStream === 'undefined') {
  Object.defineProperty(globalThis, 'ReadableStream', { value: ReadableStream, configurable: true })
}

if (typeof globalThis.TransformStream === 'undefined') {
  Object.defineProperty(globalThis, 'TransformStream', { value: TransformStream, configurable: true })
}

// Some test environments miss BroadcastChannel.
// MSW expects it for WebSocket mocking, so this minimal fallback keeps tests stable.
if (typeof globalThis.BroadcastChannel === 'undefined') {
  // @ts-expect-error: Minimal polyfill for test environment
  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor(public name: string) {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
}

// Add global t() mock (see /static/js/global_t.js)
global.t = (str: string) => str

// @ts-expect-error: ℹ️ Add chai global for BDD-style tests
global.chai = chai

// @ts-expect-error: ℹ️ Use chai's version of `expect`
global.expect = chai.expect

// @ts-expect-error: ℹ️ Add jQuery globals for xlform code
global.jQuery = global.$ = $
