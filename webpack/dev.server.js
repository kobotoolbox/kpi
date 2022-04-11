process.traceDeprecation = true;
const path = require('path');
const webpack = require('webpack');
const WebpackCommon = require('./webpack.common');
require('webpack-bundle-tracker');
const CircularDependencyPlugin = require('circular-dependency-plugin');
var isPublicDomainDefined = process.env.KOBOFORM_PUBLIC_SUBDOMAIN &&
  process.env.PUBLIC_DOMAIN_NAME;
var publicDomain = isPublicDomainDefined ? process.env.KOBOFORM_PUBLIC_SUBDOMAIN
  + '.' + process.env.PUBLIC_DOMAIN_NAME : 'localhost';
var publicPath = 'http://' + publicDomain + ':3000/static/compiled/';

module.exports = WebpackCommon({
  mode: 'development',
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
    app: ['react-hot-loader/patch', './jsapp/js/main.es6'],
    browsertests: path.resolve(__dirname, '../test/index.js'),
  },
  output: {
    library: 'KPI',
    path: path.resolve(__dirname, '../jsapp/compiled/'),
    publicPath: publicPath,
    filename: '[name]-[contenthash].js',
  },
  devServer: {
    devMiddleware: {
      publicPath: publicPath,
    },
    allowedHosts: 'all',
    hot: true,
    headers: {'Access-Control-Allow-Origin': '*'},
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      filename: '[file].map',
      exclude: /vendors.*.*/,
    }),
    new webpack.HotModuleReplacementPlugin(),
    new CircularDependencyPlugin({
      exclude: /a\.js|node_modules/,
      include: /jsapp/,
      failOnError: false,
      allowAsyncCycles: false,
      cwd: process.cwd(),
      onDetected({paths, compilation}) {
        if (paths.length === 2 && paths[0] === paths[1]) {
          // Self referencing ought to be handled by v5.2.2, but it seems
          // it isn't working properly with our setup. Plugin's GH issue:
          // https://github.com/aackerman/circular-dependency-plugin/issues/64#issuecomment-1094914430
        } else {
          compilation.warnings.push(new Error(paths.join(' -> ')));
        }
      },
    }),
  ],
});
