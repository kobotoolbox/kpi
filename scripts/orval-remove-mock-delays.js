#!/usr/bin/env node

/**
 * Post-process Orval-generated MSW handlers to remove delays.
 *
 * Orval generates mock handlers with `await delay(1000)` which is good for
 * simulating realistic loading states but causes tests to be slow and potentially
 * timeout when multiple requests are involved.
 *
 * This script removes the `await delay(1000)` lines from all generated handler files.
 */

const fs = require('fs')
const path = require('path')

const targetDir = path.join(__dirname, '../jsapp/js/api/react-query')

function removeDelays(filePath) {
  let source = fs.readFileSync(filePath, 'utf-8')
  const originalSource = source

  // Remove the delay import from msw
  source = source.replace(
    /import\s+{([^}]*),\s*delay\s*([^}]*)}\s+from\s+['"]msw['"]/g,
    (match, before, after) => {
      // Remove trailing/leading commas
      const cleaned = `${before}${after}`.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim()
      return cleaned ? `import { ${cleaned} } from 'msw'` : "import { } from 'msw'"
    }
  )

  // Remove standalone delay import
  source = source.replace(/import\s+{\s*delay\s*}\s+from\s+['"]msw['"][\s\r\n]*/g, '')

  // Remove await delay() calls
  source = source.replace(/\s*await\s+delay\(\d+\)[\s\r\n]*/g, '\n')

  if (source !== originalSource) {
    fs.writeFileSync(filePath, source, 'utf-8')
    return true
  }
  return false
}

function processDirectory(dir) {
  let modifiedCount = 0
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      modifiedCount += processDirectory(filePath)
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (removeDelays(filePath)) {
        modifiedCount++
        console.log(`Removed delays from: ${path.relative(process.cwd(), filePath)}`)
      }
    }
  }

  return modifiedCount
}

console.log('Removing delays from Orval-generated mock handlers...')
const modifiedCount = processDirectory(targetDir)
console.log(`Modified ${modifiedCount} file(s)`)
