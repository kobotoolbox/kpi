import type { Meta, StoryObj } from '@storybook/react'
import LanguageSelector from './languageSelector'

// TODO: somehow mock the `languagesStore` here, so that there are means to play with this properly :)
const meta: Meta<typeof LanguageSelector> = {
  title: 'common/LanguageSelector',
  component: LanguageSelector,
  argTypes: {},
}

export default meta

type Story = StoryObj<typeof LanguageSelector>

export const Primary: Story = {}
