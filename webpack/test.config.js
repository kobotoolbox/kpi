const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
const commitHash = require('child_process').execSync('git rev-parse --short HEAD').toString();

module.exports = WebpackCommon({
  mode: 'development',
  entry: path.resolve(__dirname, '../test/index.js'),
  output: {
    library: 'tests',
    path: path.resolve(__dirname, '../test/compiled/'),
    filename: 'app.js'
  },
  plugins: [
    new webpack.DefinePlugin({
      __FRONTEND_COMMIT__: JSON.stringify(commitHash)
    })
  ]
});
