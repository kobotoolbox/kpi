const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');

module.exports = WebpackCommon({
  mode: 'development',
  entry: path.resolve(__dirname, '../test/index.js'),
  output: {
    library: 'tests',
    path: path.resolve(__dirname, '../test/compiled/'),
    filename: 'webpack-built-tests.js'
  },
  // mainly for hiding stylelint output
  stats: {
    all: false,
    maxModules: 0,
    errors: true,
    errorDetails: true
  }
});
