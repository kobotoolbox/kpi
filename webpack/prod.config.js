const path = require('path')
const webpack = require('webpack')
const WebpackCommon = require('./webpack.common')
const TerserPlugin = require('terser-webpack-plugin')

const publicPath = (process.env.KPI_PREFIX === '/' ? '' : process.env.KPI_PREFIX || '') + '/static/compiled/'

const prodConfig = WebpackCommon({
  mode: 'production',
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          // Every entry but `errorApp` shares one `vendors` chunk. The error
          // pages have to render when the main app can't load, so they must not
          // depend on that (multi-MB) shared chunk - see
          // `scripts/check_error_bundle_isolation.js`, which fails the build if
          // this coupling ever comes back.
          chunks: (chunk) => chunk.name !== 'errorApp',
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
    // Standalone, self-contained bundle for the 404/50x pages.
    errorApp: './jsapp/js/errorApp/main.tsx',
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
})

// Print speed measurements if env variable MEASURE_WEBPACK_PLUGIN_SPEED is set
if (process.env.MEASURE_WEBPACK_PLUGIN_SPEED) {
  const SpeedMeasurePlugin = require('speed-measure-webpack-plugin')
  const smp = new SpeedMeasurePlugin()
  module.exports = smp.wrap(prodConfig)
} else {
  module.exports = prodConfig
}
