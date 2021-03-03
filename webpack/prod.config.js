const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const BundleTracker = require('webpack-bundle-tracker');
const publicPath = (process.env.KPI_PREFIX === '/' ? '' : (process.env.KPI_PREFIX || '')) + '/static/compiled/';
const WebpackCommon = require('./webpack.common');

const outputPath = path.resolve(__dirname, '../jsapp/compiled/');
// ExtractTranslationKeysPlugin, for one, just fails if this directory doesn't exist
fs.mkdirSync(outputPath, {recursive: true});

module.exports = WebpackCommon({
  mode: 'production',
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  entry: {
    app: './jsapp/js/main.es6',
    browsertests: path.resolve(__dirname, '../test/index.js')
  },
  output: {
    path: outputPath,
    publicPath: publicPath,
    filename: '[name]-[hash].js'
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      filename: '[file].map',
      exclude: /vendors.*.*/
    })
  ],
  // mainly for hiding stylelint output
  stats: {
    all: false,
    maxModules: 0,
    errors: true,
    errorDetails: true
  }
});
