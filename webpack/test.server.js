// you should not need to edit this file.
// make edits to the corresponding '.config' file
var path = require('path');
var assign = require('react/lib/Object.assign');
var WebpackDevServer = require('webpack-dev-server');
var webpack = require('webpack');
var open = require('open');

var WebpackConfig = require('./webpack-config');

var webpackConfigs = assign(WebpackConfig({
  hash: false,
  debug: true,
  entry: path.resolve(__dirname, '..', 'test', 'index'),
  optimize: false,
  saveStats: false,
  hot: true,
  failOnError: true,
  outputDir: path.resolve(__dirname, '..', 'test', 'compiled'),
  outputHash: false,
  devTool: 'eval'
}), {
  output: {
    path: path.resolve(__dirname, '..', 'test', 'compiled'),
    filename: "main.js",
    publicPath: 'options.publicPath',
  },
  entry: [
    path.resolve(__dirname, '..', 'test', 'index'),
  ],
});

var port = webpackConfigs.port || 3000;
var host = webpackConfigs.host || '0.0.0.0';

module.exports = new WebpackDevServer(
  webpack(webpackConfigs),
  {
    inline: true,
    colors: true,
    quiet: false,
    stats: {
      cached: false,
      cachedAssets: false,
      colors: true,
    },
  }
).listen(port, host, function (err, result) {
  if (err) {
    console.log(err);
  }
  console.log('Listening at '+host+':'+port);
  open('http://localhost:'+ port +'/test/tests_hot.html');
});
