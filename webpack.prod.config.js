var WebpackConfig = require('./helper/webpack-config');
var publicPath = (process.env.KPI_PREFIX === '/' ? '' : (process.env.KPI_PREFIX || '')) + '/static/compiled/';

module.exports = WebpackConfig({
  hot: false,
  hash: false,
  extractCss: true,
  publicPath: publicPath,
  debug: false,
  optimize: true,
  saveStats: true,
  failOnError: true
});
