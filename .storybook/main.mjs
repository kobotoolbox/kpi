import path from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import webpack from 'webpack'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  stories: ['../jsapp/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    'storybook-dark-mode',
    '@storybook/addon-webpack5-compiler-babel',
    'storybook-addon-remix-react-router',
    '@storybook/addon-docs',
  ],

  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript-plugin',
  },
  webpackFinal: async (config, { configType }) => {
    config.plugins.push(new webpack.ProvidePlugin({ $: ['jquery', 'default'] }))

    // Exclude .module.css and .module.scss from Storybook's default CSS rules
    config.module.rules.forEach((rule) => {
      if (rule && rule.test instanceof RegExp && rule.test.test('.css')) {
        rule.exclude = /\.module\.(css|scss)$/
      }
      // Mirror app support for `*.svg?react` imports.
      if (rule && rule.test instanceof RegExp && rule.test.test('.svg')) {
        rule.resourceQuery = {
          not: [/react/],
        }
      }
    })

    config.module.rules.unshift({
      test: /\.svg$/,
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
    })

    config.module.rules.push({
      resolve: {
        extensions: ['.jsx', '.js', '.coffee', '.ts', '.tsx', '.scss'],
        alias: {
          '#': path.join(__dirname, '../jsapp/js'),
          js: path.join(__dirname, '../jsapp/js'),
          scss: path.join(__dirname, '../jsapp/scss'),
        },
      },
    })

    // Add coffee-loader for .coffee files to support CoffeeScript in Storybook
    config.module.rules.push({
      test: /\.coffee$/,
      use: [
        {
          loader: 'coffee-loader',
          options: {
            transpile: {
              presets: ['@babel/preset-env'],
            },
          },
        },
      ],
    })
    config.module.rules.push(
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
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
          'sass-loader',
        ],
      },
      {
        test: /\.module\.css$/,
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
        ],
      },
    )

    // Build speed improvements
    applySpeedTweaks(config)

    // Print speed measurement if env variable MEASURE is set
    if (process.env.MEASURE) {
      const { default: SpeedMeasurePlugin } = await import('speed-measure-webpack-plugin')
      const smp = new SpeedMeasurePlugin()
      return smp.wrap(config)
    }
    return config
  },
  managerWebpack: async (config) => {
    // Build speed improvements
    applySpeedTweaks(config)
    if (process.env.MEASURE) {
      const { default: SpeedMeasurePlugin } = await import('speed-measure-webpack-plugin')
      const smp = new SpeedMeasurePlugin()
      return smp.wrap(config)
    }
    return config
  },
  docs: {},
  staticDirs: ['../msw-mocks'],
}

/// Apply some customizations to the config, intended to decrease build time
function applySpeedTweaks(config) {
  // Remove a linter plugin added by Storybook: CaseSensitivePathsPlugin
  // - Its purpose is to prevent macOS devs from accidentally pushing code
  //   that relies on filesystem case-insensitivity in file imports.
  // - We can let CI detect this instead, or use ESLint.
  //   'import/no-unresolved': [2, { caseSensitive: true }]
  config.plugins = config.plugins.filter((plugin) => plugin.constructor.name !== 'CaseSensitivePathsPlugin')

  // Note: Removed custom TerserPlugin with swcMinify because it doesn't handle
  // ESM code properly (import.meta, export statements). Let Storybook use its default minifier.
}
