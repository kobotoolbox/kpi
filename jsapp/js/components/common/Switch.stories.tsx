import { Box, Group, type MantineSize, Stack, Switch, type SwitchProps, Title } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useState } from 'react'

const switchSizes: MantineSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

const meta: Meta<SwitchProps> = {
  title: 'Design system/Switch',
  component: Switch,
  argTypes: {
    label: { description: 'Label displayed next to the switch', control: 'text' },
    labelPosition: {
      description: 'Position of the label relative to the switch',
      options: ['left', 'right'],
      control: 'radio',
    },
    size: { description: 'Size of the switch', options: switchSizes, control: 'radio' },
    description: { description: 'Hint displayed below the label', control: 'text' },
    error: { description: 'Error displayed below the label', control: 'text' },
    disabled: { description: 'Disables the switch', control: 'boolean' },
    checked: { description: 'Checked state (controlled)', control: 'boolean' },
    onChange: { action: 'changed' },
  },
  args: {
    label: 'Allow submissions without a username and password',
  },
}

export default meta

type Story = StoryObj<SwitchProps>

export const Default: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked ?? false)
    return <Switch {...args} checked={checked} onChange={(event) => setChecked(event.currentTarget.checked)} />
  },
}

export const WithDescription: Story = {
  args: {
    description: 'Anyone with the link will be able to submit data to this project.',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    checked: true,
  },
}

/**
 * Every combination of state and size.
 */
export const PreviewAllVariants = () => (
  <Stack gap='xl'>
    {switchSizes.map((size) => (
      <Box key={size}>
        <Title order={4} mb='sm'>
          size: <code>{size}</code>
        </Title>
        <Group gap='xl' align='top'>
          <Switch size={size} label='Off' />
          <Switch size={size} label='On' defaultChecked />
          <Switch size={size} label='Off, disabled' disabled />
          <Switch size={size} label='On, disabled' defaultChecked disabled />
          <Switch size={size} label='Label on the left' labelPosition='left' defaultChecked />
        </Group>
      </Box>
    ))}
  </Stack>
)
