import chai from 'chai';
import $ from 'jquery';

import 'whatwg-fetch'; // polyfill global fetch (for Node 20 and older)

global.t = (str: string) => str;

// @ts-expect-error: ℹ️ Add chai globals for BDD-style tests
global.chai = chai; global.expect = chai.expect;

// @ts-expect-error: ℹ️ Add jQuery globals for xlform code
global.jQuery = global.$ = $;
