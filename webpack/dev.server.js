process.traceDeprecation = true;
const path = require('path');
const WebpackCommon = require('./webpack.common');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const isPublicDomainDefined =
  process.env.KOBOFORM_PUBLIC_SUBDOMAIN && process.env.PUBLIC_DOMAIN_NAME;
const publicDomain = isPublicDomainDefined
  ? process.env.KOBOFORM_PUBLIC_SUBDOMAIN + '.' + process.env.PUBLIC_DOMAIN_NAME
  : 'localhost';
const publicPath = 'http://' + publicDomain + ':3000/static/compiled/';

let devConfig = WebpackCommon({
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
    // Some other plugins; see below.
  ],
});

// Print speed measurements if env variable MEASURE_WEBPACK_PLUGIN_SPEED is set
// Be careful with this, as SpeedMeasurePlugin's wrap(config) sometimes prevents
// other plugins from working correctly - particularly in Dev mode.
// Usually the workaround is to wrap first, then add the plugins that don't
// enjoy being wrapped.
// - https://github.com/stephencookdev/speed-measure-webpack-plugin/issues/160
// - https://github.com/stephencookdev/speed-measure-webpack-plugin/issues/167
// - https://github.com/stephencookdev/speed-measure-webpack-plugin/issues/175
if (process.env.MEASURE_WEBPACK_PLUGIN_SPEED) {
  const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
  const smp = new SpeedMeasurePlugin();
  devConfig = smp.wrap(devConfig);
}
// Plugins we add *after* wrapping with SpeedMeasureWebpackPlugin:
// - ReactRefreshWebpackPlugin
// - ForkTsCheckerWebpackPlugin
devConfig.plugins.push(new ReactRefreshWebpackPlugin());
if (!process.env.SKIP_TS_CHECK) {
  devConfig.plugins.push(new ForkTsCheckerWebpackPlugin());
}

module.exports = devConfig;
