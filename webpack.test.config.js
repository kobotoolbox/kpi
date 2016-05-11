var path = require('path');
var WebpackConfig = require('./helper/webpack-config');

module.exports = WebpackConfig({
  hash: false,
  debug: true,
  entry: path.resolve(__dirname, 'test', 'index'),
  optimize: false,
  saveStats: false,
  hot: true,
  failOnError: true,
  outputDir: path.resolve(__dirname, 'test', 'compiled'),
  outputHash: false,
  devTool: 'eval'
});
