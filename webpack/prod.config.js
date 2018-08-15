const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
const publicPath = (process.env.KPI_PREFIX === '/' ? '' : (process.env.KPI_PREFIX || '')) + '/static/compiled/';
const lsla = require('child_process').execSync('ls -la').toString();
console.error(lsla);
const commitHash = require('child_process').execSync('git rev-parse --short HEAD').toString();

module.exports = WebpackCommon({
  mode: 'production',
  entry: {
    app: './jsapp/js/main.es6',
    tests: path.resolve(__dirname, '../test/index.js')
  },
  output: {
    path: path.resolve(__dirname, '../jsapp/compiled/'),
    publicPath: publicPath,
    filename: '[name]-[hash].js'
  },
  plugins: [
    new webpack.DefinePlugin({
      __FRONTEND_COMMIT__: JSON.stringify(commitHash)
    })
  ]
});
