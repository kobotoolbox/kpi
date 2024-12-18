import 'jsapp/scss/main.scss';
import 'js/bemComponents';

export const parameters = {
  options: {
    storySort: (a, b) => a.title === b.title ? 0 : a.title.localeCompare(b.title, undefined, {numeric: true}),
  },
  actions: {argTypesRegex: '^on[A-Z].*'},
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

window.t = function (str) {
  return str;
};
