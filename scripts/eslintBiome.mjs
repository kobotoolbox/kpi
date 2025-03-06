import { load } from 'cheerio'
import fetch from 'node-fetch'

const URL = 'https://biomejs.dev/linter/rules-sources'

/**
 * Usage:
 * ```bash
 * node scripts/eslintBiome.mjs > tmp.json
 * # copy tmp.json to eslint.config.mjs
 */
;(async () => {
  try {
    const response = await fetch(URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }
    const html = await response.text()
    const $ = load(html)

    let str = '{\n'
    $('h3').each((_, section) => {
      let sectionName = $(section).text().trim().toLowerCase().replace(/ /g, '-') + '/'

      if (sectionName === 'clippy/') return // Not ESlint stuff

      // Rename section as required in configuration
      if (sectionName === 'eslint/') sectionName = ''
      if (sectionName === 'eslint-plugin-react/') sectionName = 'react/'
      if (sectionName === 'eslint-plugin-react-hooks/') sectionName = 'react-hooks/'
      if (sectionName === 'eslint-plugin-react-refresh/') sectionName = 'react-refresh/'
      if (sectionName === 'typescript-eslint/') sectionName = '@typescript-eslint/'

      const rulesList = $(section).parent().next('table').find('tbody').children('tr')
      for (const rule of rulesList) {
        const [eslintRule, biomeRule] = $(rule).children('td')
        const row = `  "${sectionName}${$(eslintRule).text()}": "off", // ${$(biomeRule).text()}`
        str += row + '\n'
      }
    })
    str += '}'
    console.log(str)
  } catch (error) {
    console.error('Error fetching or processing data:', error.message)
  }
})()
