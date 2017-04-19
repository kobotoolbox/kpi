// you should not need to edit this file.
// make edits to the corresponding '.config' file
var configs = require('./dev.server.config');

var WebpackDevServer = require('webpack-dev-server');
var webpack = require('webpack');
var port = configs.port || 3000;
var host = configs.host || '0.0.0.0';

module.exports = new WebpackDevServer(
      webpack(configs.forWebpack),
      configs.forWebpackDevServer
    ).listen(port, host, function (err, result) {
  if (err) {
    console.log(err);
  }
  console.log('Listening at '+host+':'+port);
});
