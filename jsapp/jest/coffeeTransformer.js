import coffeescript from 'coffeescript'
import createCacheKeyFunction from '@jest/create-cache-key-function'
const createCacheKey = createCacheKeyFunction.default // Note: weirdly it's exported as { default: [Function: createCacheKey] }

console.log(import.meta.resolve('coffeescript'))
console.log(new URL(import.meta.resolve('coffeescript'), import.meta.url).pathname)


/**
 * @typedef {import('@jest/transform').SyncTransformer}   SyncTransformer
 * @typedef {import('@jest/transform').TransformedSource} TransformedSource
 */

/**
 * Transform CoffeeScript files for Jest
 * See: https://jestjs.io/docs/code-transformation
 *
 * @implements { SyncTransformer }
 */
export default {
  /**
   * Process coffee files
   *
   * @param {string} sourceText
   * @param {string} filename
   * @returns {TransformedSource}
   */
  process(sourceText, filename) {
    const {js, sourceMap, v3SourceMap } = coffeescript.compile(
      sourceText,
      // ☕ CoffeeScript 1.12.7 compiler options
      {
        // 📜 For source maps
        filename,
        sourceMap: true,
        // TODO: transpile coffee script files correctly with ESM so that Jest likes it.
        // See https://coffeescript.org/#transpilation
        // See https://babeljs.io/docs/options#sourcetype
        // See https://jestjs.io/docs/ecmascript-modules
        transpile: {
          sourceType: 'module',
          targets: {
            node: 20
          }
        },

        // 📦 Same default as coffee-loader
        bare: true,
      }
    );
    return {
      code: js,
      map: JSON.parse(v3SourceMap),
    };
  },

  getCacheKey: createCacheKey(
    [import.meta.filename, new URL(import.meta.resolve('coffeescript'), import.meta.url).pathname],
  ),
};
