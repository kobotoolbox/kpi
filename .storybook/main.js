const path = require('path');
const webpack = require('webpack');
let SpeedMeasurePlugin;
if (process.env.MEASURE) {
  SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
}
module.exports = {
  stories: ['../jsapp/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    'storybook-dark-mode',
  // NB:
  // 'storybook-addon-swc' may improve build speed in the future.
  // - At time of writing, the build performance gains are negated because it
  //   switches to a slower refresh plugin and also causes other compatibility
  //   issues in Storybook 6.
  // - Testing with React 16.14.0 and Storybook 7 (beta) seemed to perform
  //   well.
  ],

  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript-plugin',
  },
  webpackFinal: async (config, {configType}) => {
    config.plugins.push(new webpack.ProvidePlugin({$: 'jquery'}));
    config.module.rules.push({
      resolve: {
        extensions: ['.jsx', '.js', '.es6', '.coffee', '.ts', '.tsx', '.scss'],
        alias: {
          app: path.join(__dirname, '../app'),
          jsapp: path.join(__dirname, '../jsapp'),
          js: path.join(__dirname, '../jsapp/js'),
          scss: path.join(__dirname, '../jsapp/scss'),
          utils: path.join(__dirname, '../jsapp/js/utils')
        }
      }
    });
    config.module.rules.push({
      test: /\.scss$/,
      exclude: /\.module\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader']
    }, {
      test: /\.module\.scss$/,
      use: ['style-loader', {
        loader: 'css-loader',
        options: {
          modules: {
            localIdentName: '[name]__[local]--[hash:base64:5]'
          },
          sourceMap: true
        }
      }, 'sass-loader']
    });

    // Build speed improvements
    applySpeedTweaks(config);

    // Print speed measurement if env variable MEASURE is set
    if (process.env.MEASURE) {
      const smp = new SpeedMeasurePlugin();
      return smp.wrap(config);
    }
    return config;
  },
  managerWebpack: async config => {
    // Build speed improvements
    applySpeedTweaks(config);
    if (process.env.MEASURE) {
      const smp = new SpeedMeasurePlugin();
      return smp.wrap(config);
    }
    return config;
  },
  docs: {
    autodocs: true
  }
};

/// Apply some customizations to the config, intended to decrease build time
function applySpeedTweaks(config) {
  // Remove a linter plugin added by Storybook: CaseSensitivePathsPlugin
  // - Its purpose is to prevent macOS devs from accidentally pushing code
  //   that relies on filesystem case-insensitivity in file imports.
  // - We can let CI detect this instead, or use ESLint.
  //   'import/no-unresolved': [2, { caseSensitive: true }]
  config.plugins = config.plugins.filter(plugin => plugin.constructor.name !== 'CaseSensitivePathsPlugin');

  // Use swc to make the Terser step faster
  if (config.mode === 'production') {
    const TerserPlugin = require('terser-webpack-plugin');
    config.optimization.minimizer = [new TerserPlugin({
      minify: TerserPlugin.swcMinify,
      terserOptions: {}
    })];
  }
}
