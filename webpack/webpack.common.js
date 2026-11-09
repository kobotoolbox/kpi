const BundleTracker = require('webpack-bundle-tracker')
const ExtractTranslationKeysPlugin = require('webpack-extract-translation-keys-plugin')
const fs = require('fs')
const lodash = require('lodash')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const path = require('path')
const webpack = require('webpack')

const outputPath = path.resolve(__dirname, '../jsapp/compiled/')
// ExtractTranslationKeysPlugin, for one, just fails if this directory doesn't exist
fs.mkdirSync(outputPath, { recursive: true })

// Production extracts CSS into its own files; dev keeps `style-loader` for hot reloading.
// `sourceMap` is set explicitly because loaders otherwise follow the JS source maps, which production keeps.
const getStyleLoaders = (isProduction, { sass = false, modules } = {}) => [
  isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
  { loader: 'css-loader', options: { sourceMap: !isProduction, ...(modules && { modules }) } },
  // HACK: we needed to define this postcss-loader because of a problem with
  // including CSS files from node_modules directory, i.e. this build error:
  // `Error: No PostCSS Config found in: /srv/node_modules/…`
  {
    loader: 'postcss-loader',
    options: {
      sourceMap: !isProduction,
      postcssOptions: {
        plugins: ['autoprefixer'],
      },
    },
  },
  ...(sass ? [{ loader: 'sass-loader', options: { sourceMap: !isProduction } }] : []),
]

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

const getCommonOptions = (isProduction) => ({
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
        use: getStyleLoaders(isProduction),
      },
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        use: getStyleLoaders(isProduction, { sass: true }),
      },
      {
        test: /\.module\.scss$/,
        use: getStyleLoaders(isProduction, {
          sass: true,
          modules: {
            localIdentName: '[name]__[local]--[hash:base64:5]',
          },
        }),
      },
      {
        test: /\.coffee$/,
        use: {
          loader: 'coffee-loader',
        },
      },
      {
        test: /\.svg$/,
        oneOf: [
          {
            resourceQuery: /react/,
            use: [
              {
                loader: '@svgr/webpack',
                options: {
                  icon: true,
                  svgo: true,
                },
              },
            ],
          },
          {
            type: 'asset/resource',
            generator: {
              filename: '[name][ext]',
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|webp|ttf|eot|woff(2)?)$/,
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
    new webpack.ProvidePlugin({ $: ['jquery', 'default'] }),
    ...(isProduction ? [new MiniCssExtractPlugin({ filename: '[name]-[contenthash].css' })] : []),
  ],
})

module.exports = (options) => {
  const commonOptions = getCommonOptions(options?.mode === 'production')
  options = lodash.mergeWith(commonOptions, options || {}, (objValue, srcValue) => {
    if (lodash.isArray(objValue)) {
      return objValue.concat(srcValue)
    }
  })
  return options
}
