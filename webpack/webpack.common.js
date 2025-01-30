import BundleTracker from 'webpack-bundle-tracker';
import ExtractTranslationKeysPlugin from 'webpack-extract-translation-keys-plugin';
import { mkdirSync } from 'fs';
import _ from 'lodash';
import { resolve as _resolve, join } from 'path';
import webpack from 'webpack';

const outputPath = _resolve(import.meta.dirname, '..', 'jsapp', 'compiled');
// ExtractTranslationKeysPlugin, for one, just fails if this directory doesn't exist
mkdirSync(outputPath, {recursive: true});

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
};

const swcLoader = {
  loader: 'swc-loader',
  options: {
    jsc: {
      transform: {
        react: {
          refresh: true
        }
      }
    }
  }
}

const commonOptions = {
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [swcLoader],
        resolve: {
            fullySpecified: false,
        },
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        // Find TypeScript errors on CI and local builds
        // Allow skipping to save resources.
        use: !process.env.SKIP_TS_CHECK
          ? [swcLoader, 'ts-loader']
          : [swcLoader],
        resolve: {
            fullySpecified: false,
        },
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
      app: join(import.meta.dirname, '..', 'app'),
      jsapp: join(import.meta.dirname, '..', 'jsapp'),
      js: join(import.meta.dirname, '..', 'jsapp', 'js'),
      scss: join(import.meta.dirname, '..', 'jsapp', 'scss'),
      utils: join(import.meta.dirname, '..', 'jsapp', 'js', 'utils'),
      test: join(import.meta.dirname, '..', 'test'),
    },
    // HACKFIX: needed because of https://github.com/react-dnd/react-dnd/issues/3423
    fallback: {
      'react/jsx-runtime': 'react/jsx-runtime.js',
      'react/jsx-dev-runtime': 'react/jsx-dev-runtime.js',
    },
  },
  plugins: [
    new BundleTracker({path: import.meta.dirname, filname: 'webpack-stats.json'}),
    new ExtractTranslationKeysPlugin({
      functionName: 't',
      output: join(outputPath, 'extracted-strings.json'),
    }),
    new webpack.ProvidePlugin({$: 'jquery'}),
  ],
};

export default function (options) {
  options = _.mergeWith(
    commonOptions,
    options || {},
    (objValue, srcValue) => {
      if (_.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    }
  );
  return options;
};
