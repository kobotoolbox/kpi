/** Reading a production build's `webpack-stats.json`, shared by the bundle checks. */

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const STATS_PATH = path.resolve(__dirname, '../webpack-stats.json')
const COMPILED_DIR = path.resolve(__dirname, '../jsapp/compiled/')

/**
 * Asset names the entry loads with the page. Source maps are separate assets the browser never requests as part
 * of the page, so they're left out.
 */
function getEntryAssets(entryName, fail) {
  if (!fs.existsSync(STATS_PATH)) {
    fail(`no stats file at ${STATS_PATH}. Run \`npm run build:app\` first.`)
  }
  const assets = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')).chunks?.[entryName]
  if (!assets) {
    fail(`entry "${entryName}" is missing from the stats file.`)
  }
  return assets.filter((name) => !name.endsWith('.map'))
}

function getGzippedSize(assetName, fail) {
  const assetPath = path.join(COMPILED_DIR, assetName)
  // A missing file means the stats came from `webpack-dev-server`, which keeps bundles in memory. Passing on those
  // would be a false green: the checks guard the production build, and dev builds aren't one.
  if (!fs.existsSync(assetPath)) {
    fail(
      `"${assetName}" is not in jsapp/compiled/.\n` +
        '  The stats file was most likely written by `npm run watch`, which serves ' +
        'bundles from memory.\n  Run `npm run build:app` and try again.',
    )
  }
  return zlib.gzipSync(fs.readFileSync(assetPath), { level: 9 }).length
}

module.exports = { getEntryAssets, getGzippedSize }
