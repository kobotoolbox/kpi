const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');

const publicPath =
  (process.env.KPI_PREFIX === '/' ? '' : process.env.KPI_PREFIX || '') +
  '/static/compiled/';

const prodConfig = WebpackCommon({
  mode: 'production',
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  entry: {
    app: './jsapp/js/main.es6',
    browsertests: path.resolve(__dirname, '../test/index.js'),
  },
  output: {
    path: path.resolve(__dirname, '../jsapp/compiled/'),
    publicPath: publicPath,
    filename: '[name]-[contenthash].js',
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      filename: '[file].map',
      exclude: /vendors.*.*/,
    }),
  ],
  // mainly for hiding stylelint output
  stats: {
    all: false,
    modulesSpace: 0,
    errors: true,
    errorDetails: true,
  },
});

// Print speed measurements if env variable MEASURE is set
const smp = new SpeedMeasurePlugin({disable: !process.env.MEASURE});
module.exports = smp.wrap(prodConfig);
