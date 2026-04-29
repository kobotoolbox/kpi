// Polyfill global fetch (for Node 20 and older)
import 'whatwg-fetch'
import { TextDecoder, TextEncoder } from 'util'

import chai from 'chai'
import $ from 'jquery'

// React Router v7 expects these globals in the test runtime.
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true })
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true })

// Add global t() mock (see /static/js/global_t.js)
global.t = (str: string) => str

// @ts-expect-error: ℹ️ Add chai global for BDD-style tests
global.chai = chai

// @ts-expect-error: ℹ️ Use chai's version of `expect`
global.expect = chai.expect

// @ts-expect-error: ℹ️ Add jQuery globals for xlform code
global.jQuery = global.$ = $
