#!/usr/bin/env node

/**
 * Renames Orval-generated files to index.ts/msw.ts pattern for cleaner imports.
 *
 * With mode: 'tags-split', Orval creates:
 *   react-query/manage-projects-and-library-content/manage-projects-and-library-content.ts
 *   react-query/manage-projects-and-library-content/manage-projects-and-library-content.msw.ts
 *
 * This script renames to:
 *   react-query/manage-projects-and-library-content/index.ts
 *   react-query/manage-projects-and-library-content/msw.ts
 *
 * So imports can be:
 *   from '#/api/react-query/manage-projects-and-library-content'        (runtime)
 *   from '#/api/react-query/manage-projects-and-library-content/msw'    (mocks)
 */

const fs = require('fs')
const path = require('path')

const REACT_QUERY_DIR = path.join(__dirname, '../jsapp/js/api/react-query')

function renameInDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDirPath = path.join(dirPath, entry.name)
      const baseFileName = `${entry.name}.ts`
      const baseMswFileName = `${entry.name}.msw.ts`

      const oldMainPath = path.join(subDirPath, baseFileName)
      const oldMswPath = path.join(subDirPath, baseMswFileName)
      const newMainPath = path.join(subDirPath, 'index.ts')
      const newMswPath = path.join(subDirPath, 'msw.ts')

      // Rename main file if it exists
      if (fs.existsSync(oldMainPath)) {
        fs.renameSync(oldMainPath, newMainPath)
        console.log(`✓ Renamed: ${entry.name}/${entry.name}.ts → ${entry.name}/index.ts`)
      }

      // Rename .msw file if it exists
      if (fs.existsSync(oldMswPath)) {
        fs.renameSync(oldMswPath, newMswPath)
        console.log(`✓ Renamed: ${entry.name}/${entry.name}.msw.ts → ${entry.name}/msw.ts`)
      }
    }
  }
}

console.log('Renaming Orval-generated files to index.ts/msw.ts pattern...')
renameInDirectory(REACT_QUERY_DIR)
console.log('Done!')
