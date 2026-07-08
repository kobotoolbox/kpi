import { Tabs } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'

const meta: Meta<typeof Tabs> = {
  title: 'Design system/Tabs',
  component: Tabs,
  decorators: [
    (Story) => (
      <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'pills', 'bubbles'],
    },
  },
  args: {
    variant: 'default',
  },
  parameters: {
    a11y: { test: 'todo' },
    docs: {
      description: {
        component:
          'Mantine Tabs theme showcase. Kobo styles the default variant as Page Tabs, pills as Button Tabs, and bubbles as Summary Tabs.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof Tabs>

const tabValues = ['one', 'two', 'three', 'four', 'five'] as const

function TabsPreview({ variant }: { variant: 'default' | 'pills' | 'bubbles' }) {
  return (
    <Tabs defaultValue='one' variant={variant}>
      <Tabs.List>
        {tabValues.map((value) => (
          <Tabs.Tab key={value} value={value}>
            Label
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  )
}

export const PageTabs: Story = {
  render: () => <TabsPreview variant='default' />,
}

export const ButtonTabs: Story = {
  render: () => <TabsPreview variant='pills' />,
}

export const SummaryTabs: Story = {
  render: () => <TabsPreview variant='bubbles' />,
}
