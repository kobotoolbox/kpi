import { keyword } from 'esutils'

/**
 * Copied some orvel internals and modified one line in order to drop the annoying `ApiV2` prefix to everything.
 */

const unicodes = (s, prefix) => {
  prefix = prefix || ''
  return s.replace(/(^|-)/g, '$1\\u' + prefix).replace(/,/g, '\\u' + prefix)
}
const lowers = 'a-z' + unicodes('DF-F6,F8-FF', '00')
const regexps = {
  upper: new RegExp('^[^' + lowers + ']+$'),
}
const low = String.prototype.toLowerCase

const decap = (s, char = 0) => {
  return low.call(s.charAt(char)) + s.slice(char + 1)
}

const camel = (s) => {
  s = s.replace('api_v2_', '') // <-- Drop the prefix. This is the only change here.
  const isStartWithUnderscore = s?.startsWith('_')
  const camelString = decap(pascal(s), isStartWithUnderscore ? 1 : 0)
  return isStartWithUnderscore ? `_${camelString}` : camelString
}

const pascal = (s) => {
  const isStartWithUnderscore = s?.startsWith('_')

  if (regexps.upper.test(s)) {
    s = low.call(s)
  }

  const pascalString = (s?.match(/[a-zA-Z0-9\u00C0-\u017F]+/g) || [])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

  const pascalWithUnderscore = isStartWithUnderscore ? `_${pascalString}` : pascalString

  return pascalWithUnderscore
}

const sanitize = (value, options) => {
  const {
    whitespace = '',
    underscore = '',
    dot = '',
    dash = '',
    es5keyword = false,
    es5IdentifierName = false,
    special = false,
  } = options ?? {}
  let newValue = value

  if (special !== true) {
    newValue = newValue.replace(/[!"`'#%&,:;<>=@{}~\$\(\)\*\+\/\\\?\[\]\^\|]/g, '')
  }

  if (whitespace !== true) {
    newValue = newValue.replace(/[\s]/g, whitespace)
  }

  if (underscore !== true) {
    newValue = newValue.replace(/['_']/g, underscore)
  }

  if (dot !== true) {
    newValue = newValue.replace(/[.]/g, dot)
  }

  if (dash !== true) {
    newValue = newValue.replace(/[-]/g, dash)
  }

  if (es5keyword) {
    newValue = keyword.isKeywordES5(newValue, true) ? `_${newValue}` : newValue
  }

  if (es5IdentifierName) {
    if (newValue.match(/^[0-9]/)) {
      newValue = `N${newValue}`
    } else {
      newValue = keyword.isIdentifierNameES5(newValue) ? newValue : `_${newValue}`
    }
  }

  return newValue
}

const getOperationId = (operation, route, verb) => {
  if (operation.operationId) {
    return operation.operationId
  }
  console.log(route)

  return pascal(
    [
      verb,
      ...route.split('/').map((p) =>
        sanitize(p, {
          dash: true,
          underscore: '-',
          dot: '-',
          whitespace: '-',
        }),
      ),
    ].join('-'),
  )
}

module.exports = {
  operationName: (operation, route, verb) =>
    sanitize(camel(getOperationId(operation, route, verb)), { es5keyword: true }),
}
