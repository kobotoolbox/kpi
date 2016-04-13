var merge = require('lodash.merge');
var webpack = require('webpack');
var path = require('path');
var url = require('url');
var autoprefixer = require('autoprefixer');
var pkg = require('../package.json');
var BundleTracker = require('webpack-bundle-tracker');

module.exports = function (options) {
  var defaultOptions = {
    hot: false,
    hash: false,
    debug: false,
    optimize: false,
    saveStats: false,
    failOnError: false,
    host: '0.0.0.0',
    port: 3000,
    publicPath: '/static/compiled/',
    https: false,
    banner: false
  };

  options = merge(defaultOptions, options || {});

  var entry = {
    app: path.join(__dirname, '../jsapp/js/main.es6')
  };

  var scssIncludePaths = [
    '~',
    path.join(__dirname, '../jsapp/scss')
  ];

  var autoprefixerOptions = {
    browsers: [
      'ie >= 10',
      'ie_mob >= 10',
      'ff >= 30',
      'chrome >= 34',
      'safari >= 7',
      'opera >= 23',
      'ios >= 7',
      'android >= 4.4',
      'bb >= 10'
    ]
  };

  var banner =
    'Name: ' + pkg.name + '\n' +
    'Version: ' + pkg.version + '\n' +
    'Description: ' + pkg.description;

  var loaders = [
    {
      test: /\.(js|jsx|es6)$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'react-hot-loader!babel-loader'
    },
    { // for third-party minified scripts, don't process require()
      test: /\.min\.js$/,
      include: /(node_modules|bower_components)/,
      loader: 'script'
    },
    {
      test: /\.json$/,
      loader: 'json-loader'
    },
    {
      test: /\.css$/,
      loader: 'style-loader!css-loader'
    },
    {
      test: /\.scss$/,
      loader: 'style-loader!css-loader!postcss-loader!sass-loader?outputStyle=expanded&' + scssIncludePaths.join('&includePaths[]=')
    },
    {
      test: /\.sass$/,
      loader: 'style-loader!css-loader!postcss-loader!sass-loader?indentedSyntax=sass'
    },
    {
      test: /\.less$/,
      loader: 'style-loader!css-loader!postcss-loader!less-loader'
    },
    {
      test: /\.coffee$/,
      loader: "coffee-loader",
    },
    { test: /\.(coffee\.md|litcoffee)$/,
      loader: "coffee-loader?literate"
    }
  ];

  if (options.hash) {
    loaders.push({
      test: /\.(png|jpg|gif)$/,
      loader: 'file-loader?name=[hash].[ext]'
    });
    loaders.push({
      test: /\.(ttf|eot|svg|woff(2)?)(\S+)?$/,
      loader: 'file-loader?name=[hash].[ext]'
    });
  } else {
    loaders.push({
      test: /\.(png|jpg|gif)$/,
      loader: 'file-loader?name=[name].[ext]'
    });
    loaders.push({
      test: /\.(ttf|eot|svg|woff(2)?)(\S+)?$/,
      loader: 'file-loader?name=[name].[ext]'
    });
  }

  var plugins = [
    new webpack.NoErrorsPlugin()
  ];

  if (options.hot) {
    plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  if (!options.optimize) {
    plugins.push(new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"development"'
      }
    }));
  } else {
    plugins.push(new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
      output: {
        comments: false
      }
    }));
    plugins.push(new webpack.optimize.DedupePlugin());
    plugins.push(new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"'
      }
    }));
    plugins.push(new webpack.NoErrorsPlugin());
  }

  if (options.saveStats) {
    plugins.push(
        new BundleTracker({
          path: path.join(__dirname, '..'),
          filename: './webpack-stats.json',
        })
      );
  }

  if (options.banner) {
    plugins.push(new webpack.BannerPlugin(banner));
  }

  var config = {
    entry: Object.keys(entry).reduce(function (result, key) {
      result[key] = options.hot ? [
        'webpack-dev-server/client?http://localhost:3000/',
        'webpack/hot/only-dev-server',
        entry[key]
      ] : entry[key];
      return result;
    }, {}),
    output: {
      path: path.resolve(__dirname, '../jsapp/compiled/'),
      filename: "[name]-[hash].js",
      publicPath: options.publicPath,
    },

    resolve: {
      extensions: ['', '.jsx', '.js', '.es6', '.coffee'],
      alias: {
        app: path.join(__dirname, '../app'),
        test: path.join(__dirname, '../test')
      }
    },
    module: {
      preLoaders: [
        {
          test: /\.(js|jsx|es6)$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'eslint-loader'
        }
      ],
      loaders: loaders
    },
    plugins: plugins,
    eslint: {
      configFile: path.join(__dirname, '../.eslintrc'),
      failOnError: options.failOnError,
      emitError: options.failOnError
    },
    postcss: function () {
      return [autoprefixer(autoprefixerOptions)];
    },
    node: {
      fs: 'empty',
      net: 'mock',
      dns: 'mock'
    },
    externals: [
      {
        './cptable': 'var cptable'
      }
    ],
    debug: options.debug
  };

  if (options.devTool) {
    config.devtool = options.devTool;
  }

  return config;
};
