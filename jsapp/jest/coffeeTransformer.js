const coffeescript = require('coffeescript');
const createCacheKeyFunction = require('@jest/create-cache-key-function').default;
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
module.exports = {
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

        // 📦 Same default as coffee-loader
        bare: true,
      }
    );
    return {
      code: js,
      map: JSON.parse(v3SourceMap),
    };
  },

  getCacheKey: createCacheKeyFunction(
    [__filename, require.resolve('coffeescript')],
  ),
};
