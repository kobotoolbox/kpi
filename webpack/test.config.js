const path = require('path');
const WebpackCommon = require('./webpack.common');

const testConfig = WebpackCommon({
  mode: 'development',
  entry: path.resolve(__dirname, '../test/index.js'),
  output: {
    library: 'tests',
    path: path.resolve(__dirname, '../test/compiled/'),
    filename: 'webpack-built-tests.js',
  },
  // mainly for hiding stylelint output
  stats: {
    all: false,
    modulesSpace: 0,
    errors: true,
    errorDetails: true,
  },
});

// Print speed measurements if env variable MEASURE_WEBPACK_PLUGIN_SPEED is set
if (process.env.MEASURE_WEBPACK_PLUGIN_SPEED) {
  const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
  const smp = new SpeedMeasurePlugin();
  module.exports = smp.wrap(testConfig);
} else {
  module.exports = testConfig;
}
