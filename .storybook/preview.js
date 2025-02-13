import 'jsapp/scss/main.scss';
import 'js/bemComponents';
import '@mantine/core/styles.css';
import {useEffect} from 'react';
import {addons} from '@storybook/preview-api';
import {DARK_MODE_EVENT_NAME} from 'storybook-dark-mode';
import {
  MantineProvider,
  useMantineColorScheme,
} from '@mantine/core';
import {themeKobo} from 'jsapp/js/theme';

const channel = addons.getChannel();

function ColorSchemeWrapper({children}) {
  const {setColorScheme} = useMantineColorScheme();
  const handleColorScheme = (value) => setColorScheme(value ? 'dark' : 'light');

  useEffect(() => {
    channel.on(DARK_MODE_EVENT_NAME, handleColorScheme);
    return () => channel.off(DARK_MODE_EVENT_NAME, handleColorScheme);
  }, [channel]);

  return <>{children}</>;
}

export const decorators = [
  (renderStory) => (
    <ColorSchemeWrapper>{renderStory()}</ColorSchemeWrapper>
  ),
  (renderStory) => (
    <MantineProvider theme={themeKobo}>{renderStory()}</MantineProvider>
  ),
];

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
