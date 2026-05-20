import type { Meta, StoryObj } from '@storybook/react-webpack5'
import environmentMock from '#/endpoints/environment.mocks'
import languagesMock from '#/endpoints/languages.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import RegionSelectorNew from './regionSelectorNew'

const meta: Meta<typeof RegionSelectorNew> = {
  title: 'Components/RegionSelector',
  component: RegionSelectorNew,
  argTypes: {
    rootLanguage: { control: 'text' },
    isDisabled: { control: 'boolean' },
  },
  decorators: [queryClientDecorator],
  parameters: {
    msw: {
      handlers: [languagesMock, environmentMock],
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof RegionSelectorNew>

export const Primary: Story = {
  args: {
    rootLanguage: 'en',
    isDisabled: false,
  },
}
