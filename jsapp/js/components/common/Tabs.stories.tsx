import { Box, Group, Stack, Tabs, type TabsProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'

const tabsVariants = ['default', 'pills', 'bubble'] as const
const tabsSizes = ['sm', 'md', 'lg'] as const

const SampleTabs = (props: Partial<TabsProps>) => (
  <Tabs defaultValue='overview' {...props}>
    <Tabs.List>
      <Tabs.Tab value='overview'>Overview</Tabs.Tab>
      <Tabs.Tab value='details'>Details</Tabs.Tab>
      <Tabs.Tab value='settings'>Settings</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value='overview' pt='md'>
      Overview panel content
    </Tabs.Panel>
    <Tabs.Panel value='details' pt='md'>
      Details panel content
    </Tabs.Panel>
    <Tabs.Panel value='settings' pt='md'>
      Settings panel content
    </Tabs.Panel>
  </Tabs>
)

const meta: Meta<TabsProps> = {
  title: 'Design system/Tabs',
  component: Tabs,
  argTypes: {
    variant: {
      description: 'Visual style of the tabs',
      options: tabsVariants,
      control: 'radio',
    },
    size: {
      description: 'Size of the tabs',
      options: tabsSizes,
      control: 'radio',
    },
  },
  args: {
    variant: 'default',
    size: 'sm',
  },
  render: (args) => <SampleTabs {...args} />,
  parameters: {
    a11y: { disable: true },
  },
}

export default meta

type Story = StoryObj<TabsProps>

export const Primary: Story = {}

export const PreviewAllVariants = () => (
  <>
    {tabsVariants.map((variant) => (
      <Box key={variant} mb='xl'>
        <Group gap='xl' align='top'>
          {tabsSizes.map((size) => (
            <Stack key={size} gap='sm'>
              <SampleTabs variant={variant} size={size} />
            </Stack>
          ))}
        </Group>
      </Box>
    ))}
  </>
)
