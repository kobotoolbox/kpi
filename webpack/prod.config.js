import { resolve } from 'path';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import SpeedMeasurePlugin from 'speed-measure-webpack-plugin'

import WebpackCommon from './webpack.common.js';

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
    // Speed up the minify step with swc
    // https://webpack.js.org/plugins/terser-webpack-plugin/#swc
    minimizer: [
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
        terserOptions: {},
      }),
    ],
  },
  entry: {
    app: './jsapp/js/main.js',
  },
  output: {
    path: resolve(import.meta.dirname, '../jsapp/compiled/'),
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


// Print speed measurements if env variable MEASURE_WEBPACK_PLUGIN_SPEED is set
const smp = new SpeedMeasurePlugin();
export default process.env.MEASURE_WEBPACK_PLUGIN_SPEED ? smp.wrap(prodConfig) : prodConfig
