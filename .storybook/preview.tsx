import '../jsapp/scss/main.scss'
import '#/bemComponents'
import '@mantine/core/styles.css'
import { MantineProvider, useMantineColorScheme } from '@mantine/core'
import type { Preview } from '@storybook/react'
import * as mswAddon from 'msw-storybook-addon'
import { useEffect } from 'react'
import { DARK_MODE_EVENT_NAME } from 'storybook-dark-mode'
import { addons } from 'storybook/preview-api'
import { themeKobo } from '../jsapp/js/theme'

// Imported with `as` to avoid having confusing `initialize` (i.e. what does it initialize?)
mswAddon.initialize()

const channel = addons.getChannel()

// To make it possible for the code to know if running in the context of Storybook
window.isStorybook = true

function ColorSchemeWrapper({ children }: { children: JSX.Element }) {
  const { setColorScheme } = useMantineColorScheme()
  const handleColorScheme = (value: string) => setColorScheme(value ? 'dark' : 'light')

  useEffect(() => {
    channel.on(DARK_MODE_EVENT_NAME, handleColorScheme)
    return () => channel.off(DARK_MODE_EVENT_NAME, handleColorScheme)
  }, [channel])

  return <>{children}</>
}

window.t = (str) => str

const preview: Preview = {
  decorators: [
    (Story) => <ColorSchemeWrapper>{Story()}</ColorSchemeWrapper>,
    (Story) => <MantineProvider theme={themeKobo}>{Story()}</MantineProvider>,
  ],
  loaders: [mswAddon.mswLoader],
  tags: ['autodocs'],
  parameters: {
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
    a11y: { test: 'error' },
    verbose: false,
  },
}

export default preview
