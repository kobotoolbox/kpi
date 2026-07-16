/*
 * This scripts generates icon font from our SVG icons to be used in the app.
 */

const { generateFonts } = require('fantasticon')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'jsapp/svg-icons')
const destDir = path.join(root, 'jsapp/fonts')

console.warn(
  '\x1b[31m***\n',
  'Please make sure SVGs are at least 280px in size! Otherwise glyphs will look terrible during svg2ttf conversion.',
  '\n***',
  '\x1b[0m',
)

fs.mkdirSync(destDir, { recursive: true })

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
    css: path.join(root, 'jsapp/k-icons-css-template.hbs'),
    html: undefined,
  },
})
  .then(({ codepoints }) => {
    console.info('Generating TypeScript definitions…')
    const icons = Object.keys(codepoints)
    // Quoted keys are required because icon names contain hyphens (e.g. 'qt-file')
    const typeParts = icons.map((name) => `'${name}'`)
    const enumParts = icons.map((name) => `'${name}' = '${name}'`)
    const fileContent = [
      `export type IconName = ${typeParts.join(' | ')}`,
      `export enum IconNames {${enumParts.join(', ')}}`,
    ].join('\n')
    fs.writeFileSync(path.join(destDir, 'k-icons.ts'), fileContent)

    console.info('Done.')
  })
  .catch((error) => {
    console.error('Font generation failed:', error)
    process.exit(1)
  })
