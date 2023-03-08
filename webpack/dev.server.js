process.traceDeprecation = true;
const path = require('path');
const WebpackCommon = require('./webpack.common');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const isPublicDomainDefined =
  process.env.KOBOFORM_PUBLIC_SUBDOMAIN && process.env.PUBLIC_DOMAIN_NAME;
const publicDomain = isPublicDomainDefined
  ? process.env.KOBOFORM_PUBLIC_SUBDOMAIN + '.' + process.env.PUBLIC_DOMAIN_NAME
  : 'localhost';
const publicPath = 'http://' + publicDomain + ':3000/static/compiled/';

const devConfig = WebpackCommon({
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
    app: ['./jsapp/js/main.es6'],
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
  devtool: 'eval-source-map',
  plugins: [
    new CircularDependencyPlugin({
      exclude: /a\.js|node_modules/,
      include: /jsapp/,
      failOnError: false,
      allowAsyncCycles: false,
      cwd: process.cwd(),
    }),
    new ReactRefreshWebpackPlugin(),
  ],
});

// Print speed measurements if env variable MEASURE is set
if (process.env.MEASURE) {
  const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
  const smp = new SpeedMeasurePlugin();
  module.exports = smp.wrap(devConfig);
} else {
  module.exports = devConfig;
}
