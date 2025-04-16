import 'scss/main.scss'
import '#/bemComponents'
import '@mantine/core/styles.css'

import { useEffect } from 'react'

import { MantineProvider, useMantineColorScheme } from '@mantine/core'
import { addons } from '@storybook/preview-api'
import * as mswAddon from 'msw-storybook-addon'
import { DARK_MODE_EVENT_NAME } from 'storybook-dark-mode'
import { themeKobo } from '#/theme'

// Imported with `as` to avoid having confusing `initialize` (i.e. what does it initialize?)
mswAddon.initialize()

const channel = addons.getChannel()

function ColorSchemeWrapper({ children }) {
  const { setColorScheme } = useMantineColorScheme()
  const handleColorScheme = (value) => setColorScheme(value ? 'dark' : 'light')

  useEffect(() => {
    channel.on(DARK_MODE_EVENT_NAME, handleColorScheme)
    return () => channel.off(DARK_MODE_EVENT_NAME, handleColorScheme)
  }, [channel])

  return <>{children}</>
}

export const decorators = [
  (renderStory) => <ColorSchemeWrapper>{renderStory()}</ColorSchemeWrapper>,
  (renderStory) => <MantineProvider theme={themeKobo}>{renderStory()}</MantineProvider>,
]

export const loaders = [mswAddon.mswLoader]

export const parameters = {
  options: {
    storySort: {
      method: 'alphabetical',
      order: ['Design system', 'Design system old', 'Components', '*'],
    },
  },
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}

window.t = (str) => str
export const tags = ['autodocs']
