process.traceDeprecation = true;
const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
const BundleTracker = require('webpack-bundle-tracker');
var publicPath = 'http://localhost:3000/static/compiled/';

module.exports = WebpackCommon({
  mode: "development",
  entry: {
    app: ['react-hot-loader/patch', './jsapp/js/main.es6'],
    tests: path.resolve(__dirname, '../test/index.js')
  },
  output: {
    library: 'KPI',
    path: path.resolve(__dirname, '../jsapp/compiled/'),
    publicPath: publicPath,
    filename: "[name]-[hash].js"
  },
  devServer: {
    publicPath: publicPath,
    disableHostCheck: true,
    hot: true,
    headers: {'Access-Control-Allow-Origin': '*'},
    port: 3000
  },
  plugins: [
    new BundleTracker({path: __dirname, filename: '../webpack-stats.json'}),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin()
  ]
});
