/*
 * This scripts generates icon font from our SVG icons to be used in the app.
 */

const { generateFonts } = require('fantasticon')
const fs = require('fs')
const path = require('path')

const sourceDir = 'jsapp/svg-icons'
const destDir = 'jsapp/fonts'

console.warn(
  '\x1b[31m***\n',
  'Please make sure SVGs are at least 280px in size! Otherwise glyphs will look terrible during svg2ttf conversion.',
  '\n***',
  '\x1b[0m',
)

console.info('Generating fonts…')
generateFonts({
  name: 'k-icons',
  inputDir: sourceDir,
  outputDir: destDir,
  fontTypes: ['eot', 'svg', 'ttf', 'woff', 'woff2'],
  assetTypes: ['css', 'html'],
  prefix: 'k-icon',
  selector: '.k-icon',
  fontsUrl: '../fonts/',
  normalize: false,
  fontHeight: 10000,
  descent: 0,
  round: 0,
  formatOptions: {
    svg: {
      fontStyle: 'normal',
      fontWeight: 'normal',
      fixedWidth: true,
      centerHorizontally: false,
      normalize: false,
      height: 10000,
      round: 0,
      descent: 0,
      ascent: undefined,
    },
  },
  templates: {
    css: path.resolve('jsapp/k-icons-css-template.hbs'),
    html: undefined,
  },
})
  .then(({ codepoints }) => {
    console.info('Copying k-icons.css to SCSS file…')
    fs.copyFileSync(
      path.join(destDir, 'k-icons.css'),
      path.join(destDir, 'k-icons.scss'),
    )

    console.info('Generating TypeScript definitions…')
    const icons = Object.keys(codepoints)
    const typeParts = icons.map((name) => `'${name}'`)
    const enumParts = icons.map((name) => `'${name}' = '${name}'`)
    const fileContent = `export type IconName = ${typeParts.join(' | ')}\nexport enum IconNames {${enumParts.join(', ')}}`
    fs.writeFileSync(path.join(destDir, 'k-icons.ts'), fileContent)

    console.info('Done.')
  })
  .catch((error) => {
    throw new Error('Font generation failed', { cause: error })
  })
