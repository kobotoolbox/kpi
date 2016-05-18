var WebpackConfig = require('./helper/webpack-config');

module.exports = WebpackConfig({
  hot: false,
  hash: false,
  extractCss: true,
  publicPath: '/forms/static/compiled/',
  debug: false,
  optimize: true,
  saveStats: true,
  failOnError: true
});
