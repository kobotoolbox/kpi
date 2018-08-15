const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
const publicPath = (process.env.KPI_PREFIX === '/' ? '' : (process.env.KPI_PREFIX || '')) + '/static/compiled/';

const plugins = [];
try {
  const commitHash = require('child_process').execSync('git rev-parse --short HEAD').toString();
  plugins.push(
    new webpack.DefinePlugin({
      __FRONTEND_COMMIT__: JSON.stringify(commitHash)
    })
  );
} catch (e) {
  console.warn('Could not generate frontend commit hash, due to errors. Continuing…');
}


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
  plugins: plugins
});
