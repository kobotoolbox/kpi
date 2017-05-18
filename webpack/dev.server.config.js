var publicPath = 'http://localhost:3000/static/compiled/';

var webpackConfigs = require('./webpack-config')({
  saveStats: true,
  hot: true,
  inline: true,
  publicPath: publicPath,
});

var webpackDevServerConfigs = {
  publicPath: publicPath,
  hot: true,
  inline: true,
  historyApiFallback: true,
  disableHostCheck: true,
  headers: { 'Access-Control-Allow-Origin': '*' }
};

module.exports = {
  forWebpackDevServer: webpackDevServerConfigs,
  forWebpack: webpackConfigs,
};
