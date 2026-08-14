#!/usr/bin/env node
/**
 * Guards the one property of the `errorApp` bundle that code review can't see:
 * that it stays self-contained.
 *
 * The `chunks` predicate in `webpack/prod.config.js` is what keeps the entry out
 * of the shared `vendors` chunk. Simplifying it back to `chunks: 'all'` would
 * make the error pages pull in the multi-MB main app bundle, and every test
 * would still pass, so this runs in CI after a production build.
 */

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const ENTRY_NAME = 'errorApp'
const STATS_PATH = path.resolve(__dirname, '../webpack-stats.json')

function fail(message) {
  console.error(`✘ ${ENTRY_NAME} bundle check failed: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(STATS_PATH)) {
  fail(`no stats file at ${STATS_PATH}. Run \`npm run build:app\` first.`)
}

const stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'))
const chunk = stats.chunks?.[ENTRY_NAME]

if (!chunk) {
  fail(`entry "${ENTRY_NAME}" is missing from the stats file.`)
}

// `chunks[name]` lists the asset names the entry needs; `assets` maps those to
// details. Source maps are emitted as separate assets and never requested by the
// browser as part of the page, so they don't count.
const jsAssets = chunk.filter((name) => name.endsWith('.js'))

if (jsAssets.length !== 1) {
  fail(
    `expected exactly 1 JS asset, found ${jsAssets.length}:\n` +
      jsAssets.map((name) => `    - ${name}`).join('\n') +
      '\n  The entry must not share a chunk with the main app. Check the ' +
      '`splitChunks` config in `webpack/prod.config.js`.',
  )
}

const assetPath = path.resolve(__dirname, '../jsapp/compiled/', jsAssets[0])

// A missing file means the stats came from `webpack-dev-server`, which keeps
// bundles in memory. Passing on those would be a false green: this check exists
// to guard the production `splitChunks` config, and dev builds don't use it.
if (!fs.existsSync(assetPath)) {
  fail(
    `"${jsAssets[0]}" is not in jsapp/compiled/.\n` +
      '  The stats file was most likely written by `npm run watch`, which serves ' +
      'bundles from memory.\n  Run `npm run build:app` and try again.',
  )
}

const gzipped = zlib.gzipSync(fs.readFileSync(assetPath), { level: 9 }).length

console.log(
  `✔ ${ENTRY_NAME} is self-contained: ${jsAssets[0]} (${(gzipped / 1024).toFixed(1)} KB gzipped)`,
)
