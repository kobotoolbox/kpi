
const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');

module.exports = WebpackCommon({
  mode: "development",
  entry: path.resolve(__dirname, '../test/index.js'),
  output: {
    library: 'KPI Tests',
    path: path.resolve(__dirname, '../test/compiled/'),
    filename: "[name].js"
  }
});
