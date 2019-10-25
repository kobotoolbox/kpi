const path = require('path');
const webpack = require('webpack');
const BundleTracker = require('webpack-bundle-tracker');
var merge = require('lodash.merge');

// HACK: we needed to define this postcss-loader because of a problem with
// including CSS files from node_modules directory, i.e. this build error:
// `Error: No PostCSS Config found in: /srv/node_modules/…`
const postCssLoader = {
  loader: 'postcss-loader',
  options: {
    sourceMap: true,
    config: {
       path: path.resolve(__dirname, '../postcss.config.js')
    },
    plugins: [
      require('autoprefixer')
    ]
  }
};

var defaultOptions = {
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.(js|jsx|es6)$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
        options: {
          quiet: true
        }
      },
      {
        test: /\.(js|jsx|es6)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env', 'react'],
            plugins: ['add-module-exports', 'react-hot-loader/babel']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', postCssLoader]
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', postCssLoader, 'sass-loader']
      },
      {
        test: /\.coffee$/,
        use: {
          loader: 'coffee-loader'
        }
      },
      {
        test: /\.(png|jpg|gif|ttf|eot|svg|woff(2)?)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]'
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.jsx', '.js', '.es6', '.coffee'],
    alias: {
      app: path.join(__dirname, '../app'),
      js: path.join(__dirname, '../jsapp/js'),
      utils: path.join(__dirname, '../jsapp/js/utils'),
      test: path.join(__dirname, '../test'),
    }
  },
  plugins: [
    new BundleTracker({path: __dirname, filename: '../webpack-stats.json'})
  ]
};

module.exports = function (options) {
  options = merge(defaultOptions, options || {});
  return options;
};
