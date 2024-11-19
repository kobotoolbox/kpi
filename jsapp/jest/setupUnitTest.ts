import chai from 'chai';
import $ from 'jquery';

// Polyfill global fetch (for Node 20 and older)
import 'whatwg-fetch';

// Add global t() mock (see /static/js/global_t.js)
global.t = (str: string) => str;

// @ts-expect-error: ℹ️ Add chai global for BDD-style tests
global.chai = chai;

// @ts-expect-error: ℹ️ Use chai's version of `expect`
global.expect = chai.expect;

// @ts-expect-error: ℹ️ Add jQuery globals for xlform code
global.jQuery = global.$ = $;
