#!/usr/bin/env node
/**
 * Fails when an entry's initial download goes over its limit, or when dev-only code (stories, mocks, msw) gets into
 * the production build. Neither breaks the build or a test, so this runs in CI after a production build.
 */

const fs = require('node:fs')
const { REPORT_PATH } = require('../webpack/bundleReportPlugin')
const { getEntryAssets, getGzippedSize } = require('./bundleStats')

// Gzipped JS + CSS each entry loads with the page, in KB: the measured size + 10%. Going over on purpose? Raise it
// here, so the jump shows up in review.
const LIMITS_KB = {
  app: 990,
  errorApp: 68,
}
const BREAKDOWN_LENGTH = 15

function fail(message) {
  console.error(`✘ bundle size check failed: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(REPORT_PATH)) {
  fail(`no report at ${REPORT_PATH}. Run \`npm run build:app\` first.`)
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'))
const problems = []

if (report.devOnlyModules.length > 0) {
  problems.push(
    'dev-only modules are in the production build:\n' + report.devOnlyModules.map((name) => `    - ${name}`).join('\n'),
  )
}

for (const [entryName, limitKb] of Object.entries(LIMITS_KB)) {
  const assets = getEntryAssets(entryName, fail).filter((name) => /\.(js|css)$/.test(name))
  const sizeKb = assets.reduce((total, name) => total + getGzippedSize(name, fail), 0) / 1024

  if (sizeKb <= limitKb) {
    console.log(`✔ ${entryName}: ${sizeKb.toFixed(1)} KB gzipped (limit ${limitKb} KB)`)
    continue
  }

  // Sizes from before minification, so only good for comparing the parts with each other.
  const breakdown = Object.entries(report.entries[entryName] ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, BREAKDOWN_LENGTH)
    .map(([group, bytes]) => `    ${(bytes / 1024).toFixed(0).padStart(6)} KB  ${group}`)
  problems.push(
    `${entryName} is ${sizeKb.toFixed(1)} KB gzipped, over its ${limitKb} KB limit. ` +
      `Biggest parts, before minification:\n${breakdown.join('\n')}`,
  )
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`✘ ${problem}`)
  }
  process.exit(1)
}
