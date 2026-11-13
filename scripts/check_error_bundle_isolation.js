#!/usr/bin/env node
/**
 * Guards the one property of the `errorApp` bundle that code review can't see:
 * that it stays self-contained.
 *
 * The `chunks` predicate in `webpack/webpack.common.js` is what keeps the entry out
 * of the shared `vendors` chunk. Simplifying it back to `chunks: 'all'` would
 * make the error pages pull in the multi-MB main app bundle, and every test
 * would still pass, so this runs in CI after a production build.
 */

const { getEntryAssets, getGzippedSize } = require('./bundleStats')

const ENTRY_NAME = 'errorApp'

function fail(message) {
  console.error(`✘ ${ENTRY_NAME} bundle check failed: ${message}`)
  process.exit(1)
}

const jsAssets = getEntryAssets(ENTRY_NAME, fail).filter((name) => name.endsWith('.js'))

if (jsAssets.length !== 1) {
  fail(
    `expected exactly 1 JS asset, found ${jsAssets.length}:\n` +
      jsAssets.map((name) => `    - ${name}`).join('\n') +
      '\n  The entry must not share a chunk with the main app. Check the ' +
      '`splitChunks` config in `webpack/webpack.common.js`.',
  )
}

const gzipped = getGzippedSize(jsAssets[0], fail)

console.log(
  `✔ ${ENTRY_NAME} is self-contained: ${jsAssets[0]} (${(gzipped / 1024).toFixed(1)} KB gzipped)`,
)
