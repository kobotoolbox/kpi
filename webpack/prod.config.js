const path = require('path');
const webpack = require('webpack');
const publicPath = (process.env.KPI_PREFIX === '/' ? '' : (process.env.KPI_PREFIX || '')) + '/static/compiled/';
const WebpackCommon = require('./webpack.common');

module.exports = WebpackCommon({
  mode: "production",
  entry: {
    app: './jsapp/js/main.es6',
    tests: path.resolve(__dirname, '../test/index.js')
  },
  output: {
    path: path.resolve(__dirname, '../jsapp/compiled/'),
    publicPath: publicPath,
    filename: "[name]-[hash].js"
  },
});
