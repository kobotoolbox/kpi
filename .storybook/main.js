const path = require('path');

const postCssLoader = {
  loader: 'postcss-loader',
  options: {
    sourceMap: true,
    postcssOptions: {
      plugins: [
        'autoprefixer',
      ],
    },
  },
};

module.exports = {
  stories: [
    '../jsapp/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: '@storybook/react',
  core: {
    builder: '@storybook/builder-webpack5',
  },
  webpackFinal: async (config, {configType}) => {
    config.module.rules.push({
      resolve: {
        extensions: ['.jsx', '.js', '.es6', '.coffee', '.ts', '.tsx', '.scss'],
        alias: {
          app: path.join(__dirname, '../app'),
          jsapp: path.join(__dirname, '../jsapp'),
          js: path.join(__dirname, '../jsapp/js'),
          scss: path.join(__dirname, '../jsapp/scss'),
        },
      },
    });
    config.module.rules.push(
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        use: ['style-loader', 'css-loader', postCssLoader, 'sass-loader'],
      },
      {
        test: /\.module\.scss$/,
        use: ['style-loader', {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName:'[name]__[local]--[hash:base64:5]',
            },
            sourceMap: true
          }
        }, postCssLoader, 'sass-loader'],
      },
    );
    return config;
  },
};
