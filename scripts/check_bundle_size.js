#!/usr/bin/env node
/**
 * Fails when an entry's initial download goes over its limit, or when dev-only code (stories, mocks, msw) gets into
 * the production build. Neither breaks the build or a test, so this runs in CI after a production build.
 *
 * Writes the sizes it measured to `webpack-bundle-sizes.json`. Point `BUNDLE_SIZE_BASE` at another run's copy
 * (CI does, with main's, for PRs into main) to see what changed.
 */

const fs = require('node:fs')
const path = require('node:path')
const { REPORT_PATH } = require('../webpack/bundleReportPlugin')
const { getEntryAssets, getGzippedSize } = require('./bundleStats')

// Gzipped JS + CSS each entry loads with the page, in KB: the measured size + 10%. Going over on purpose? Raise it
// here, so the jump shows up in review.
const LIMITS_KB = {
  app: 990,
  errorApp: 68,
}
const BREAKDOWN_LENGTH = 15
// Smaller changes in the parts are noise from minor edits, not worth listing.
const MIN_CHANGE_BYTES = 1024
const SIZES_PATH = path.resolve(__dirname, '../webpack-bundle-sizes.json')

function fail(message) {
  console.error(`✘ bundle size check failed: ${message}`)
  process.exit(1)
}

const formatKb = (bytes, decimals = 0) => `${(bytes / 1024).toFixed(decimals)} KB`

/** `(+1234 KB)`, or nothing without a base size to compare with. */
function formatChange(bytes, baseBytes, decimals = 0) {
  if (baseBytes === undefined) {
    return ''
  }
  const change = bytes - baseBytes
  return `(${change < 0 ? '-' : '+'}${formatKb(Math.abs(change), decimals)})`
}

/** Breakdown lines, e.g. `    1640 KB (+1234 KB)  jsapp/js/components`. */
function formatParts(title, parts, groups, baseGroups) {
  const lines = parts.map((group) => {
    const bytes = groups[group] ?? 0
    const baseBytes = baseGroups && (baseGroups[group] ?? 0)
    const change = Math.abs(bytes - (baseBytes ?? bytes)) >= MIN_CHANGE_BYTES ? formatChange(bytes, baseBytes) : ''
    return `    ${formatKb(bytes).padStart(7)} ${change.padEnd(baseGroups ? 11 : 0)} ${group}`
  })
  // Sizes from before minification, so only good for comparing the parts with each other.
  return `  ${title}, before minification:\n${lines.join('\n')}`
}

if (!fs.existsSync(REPORT_PATH)) {
  fail(`no report at ${REPORT_PATH}. Run \`npm run build:app\` first.`)
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'))
const basePath = process.env.BUNDLE_SIZE_BASE
const base = basePath && fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : undefined
const sizes = {}
const problems = []

if (report.devOnlyModules.length > 0) {
  problems.push(
    'dev-only modules are in the production build:\n' + report.devOnlyModules.map((name) => `    - ${name}`).join('\n'),
  )
}

for (const [entryName, limitKb] of Object.entries(LIMITS_KB)) {
  const assets = getEntryAssets(entryName, fail).filter((name) => /\.(js|css)$/.test(name))
  const gzipped = assets.reduce((total, name) => total + getGzippedSize(name, fail), 0)
  const groups = report.entries[entryName] ?? {}
  sizes[entryName] = { gzipped, groups }

  const baseGroups = base?.[entryName]?.groups
  const output = [
    `${entryName}: ${formatKb(gzipped, 1)} gzipped ${formatChange(gzipped, base?.[entryName]?.gzipped, 1)}`.trim(),
  ]
  if (baseGroups) {
    const change = (group) => (groups[group] ?? 0) - (baseGroups[group] ?? 0)
    const changed = [...new Set([...Object.keys(groups), ...Object.keys(baseGroups)])]
      .filter((group) => Math.abs(change(group)) >= MIN_CHANGE_BYTES)
      .sort((a, b) => Math.abs(change(b)) - Math.abs(change(a)))
      .slice(0, BREAKDOWN_LENGTH)
    if (changed.length > 0) {
      output.push(formatParts('Biggest changes', changed, groups, baseGroups))
    }
  }

  if (gzipped <= limitKb * 1024) {
    output[0] += ` (limit ${limitKb} KB)`
    console.log(`✔ ${output.join('\n')}`)
    continue
  }

  const biggest = Object.keys(groups)
    .sort((a, b) => groups[b] - groups[a])
    .slice(0, BREAKDOWN_LENGTH)
  output[0] += `, over its ${limitKb} KB limit.`
  output.push(formatParts('Biggest parts', biggest, groups, baseGroups))
  problems.push(output.join('\n'))
}

fs.writeFileSync(SIZES_PATH, JSON.stringify(sizes, null, 2))

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`✘ ${problem}`)
  }
  process.exit(1)
}
