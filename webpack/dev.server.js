const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
var publicPath = 'http://localhost:3000/static/compiled/';

module.exports = WebpackCommon({
  mode: "development",
  output: {
    path: path.resolve(__dirname, '../jsapp/compiled/'),
    publicPath: publicPath,
    filename: "[name]-[hash].js"
  },
  devServer: {
    publicPath: publicPath,
    disableHostCheck: true,
    headers: {'Access-Control-Allow-Origin': '*'},
    port: 3000
  }
});
