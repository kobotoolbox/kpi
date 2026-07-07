/* eslint-disable no-console */
/**
 * Django REST Framework adds trailing slashes to all URLs, so Orval-generated
 * MSW handlers end with '/'. But the frontend sometimes drops the slash.
 *
 * We fix this by appending '?' to make the slash optional in handler patterns.
 * Both /api/v2/assets/123/history/actions and /actions/ will match.
 */
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const REACT_QUERY_DIR = path.join(ROOT, 'jsapp/js/api/react-query')

let totalFixed = 0

function processFile(filePath) {
  let source = fs.readFileSync(filePath, 'utf8')
  let modified = false

  // Change http.get('path/', ...) to http.get('path{/}?', ...)
  // The {/}? syntax makes the trailing slash optional in path-to-regexp
  const pattern = /http\.(get|post|put|patch|delete)\('(\*\/[^']+)\/'/g

  source = source.replace(pattern, (match, method, pathWithoutSlash) => {
    if (pathWithoutSlash.endsWith('{/}')) {
      return match
    }
    modified = true
    return `http.${method}('${pathWithoutSlash}{/}?'`
  })

  if (modified) {
    fs.writeFileSync(filePath, source, 'utf8')
    totalFixed++
  }

  return modified
}

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      processDirectory(fullPath)
    } else if (entry.name.endsWith('.ts')) {
      processFile(fullPath)
    }
  }
}

processDirectory(REACT_QUERY_DIR)

if (totalFixed > 0) {
  console.log(`✔ Made trailing slashes optional in ${totalFixed} react-query files`)
}
