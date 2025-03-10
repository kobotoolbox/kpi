const BundleTracker = require('webpack-bundle-tracker')
const ExtractTranslationKeysPlugin = require('webpack-extract-translation-keys-plugin')
const fs = require('fs')
const lodash = require('lodash')
const path = require('path')
const webpack = require('webpack')

const outputPath = path.resolve(__dirname, '../jsapp/compiled/')
// ExtractTranslationKeysPlugin, for one, just fails if this directory doesn't exist
fs.mkdirSync(outputPath, { recursive: true })

// HACK: we needed to define this postcss-loader because of a problem with
// including CSS files from node_modules directory, i.e. this build error:
// `Error: No PostCSS Config found in: /srv/node_modules/…`
const postCssLoader = {
  loader: 'postcss-loader',
  options: {
    sourceMap: true,
    postcssOptions: {
      plugins: ['autoprefixer'],
    },
  },
}

const swcLoader = {
  loader: require.resolve('swc-loader'),
  options: {
    jsc: {
      transform: {
        react: {
          refresh: true,
        },
      },
    },
  },
}

const commonOptions = {
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [swcLoader],
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        // Find TypeScript errors on CI and local builds
        // Allow skipping to save resources.
        use: process.env.SKIP_TS_CHECK ? [swcLoader] : [swcLoader, 'ts-loader'],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', postCssLoader],
      },
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        use: ['style-loader', 'css-loader', postCssLoader, 'sass-loader'],
      },
      {
        test: /\.module\.scss$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]--[hash:base64:5]',
              },
              sourceMap: true,
            },
          },
          postCssLoader,
          'sass-loader',
        ],
      },
      {
        test: /\.coffee$/,
        use: {
          loader: 'coffee-loader',
        },
      },
      {
        test: /\.(png|jpg|gif|ttf|eot|svg|woff(2)?)$/,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.jsx', '.js', '.coffee', '.ts', '.tsx', '.scss'],
    alias: {
      '#': path.join(__dirname, '..', 'jsapp', 'js'), // TODO: someday rename "js" to "src".
      js: path.join(__dirname, '..', 'jsapp', 'js'), // within scss files only, sass-loader doesn't handle # char.
      scss: path.join(__dirname, '..', 'jsapp', 'scss'), // within scss files only.
    },
    // HACKFIX: needed because of https://github.com/react-dnd/react-dnd/issues/3423
    fallback: {
      'react/jsx-runtime': 'react/jsx-runtime.js',
      'react/jsx-dev-runtime': 'react/jsx-dev-runtime.js',
    },
  },
  plugins: [
    new BundleTracker({ path: __dirname, filename: 'webpack-stats.json' }),
    new ExtractTranslationKeysPlugin({
      functionName: 't',
      output: path.join(outputPath, 'extracted-strings.json'),
    }),
    new webpack.ProvidePlugin({ $: 'jquery' }),
  ],
}

module.exports = (options) => {
  options = lodash.mergeWith(commonOptions, options || {}, (objValue, srcValue) => {
    if (lodash.isArray(objValue)) {
      return objValue.concat(srcValue)
    }
  })
  return options
}
