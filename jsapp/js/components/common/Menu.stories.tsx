import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { ComponentProps } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import ActionIcon from './ActionIcon'
import Menu from './Menu'
import Icon from './icon'
import '@mantine/core/styles.css'
import ButtonNew from './ButtonNew'

type StoryArgs = ComponentProps<typeof Menu> & {
  onDeleteClick?: () => void
  ['data-testid']?: string
}

type Story = StoryObj<StoryArgs>

// We need the story demo area to be bigger to accomodate for opened menu
const storyAreaStyle = {
  minHeight: 360,
  padding: 'var(--mantine-spacing-lg)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
}

const meta = {
  title: 'Design system/Menu',
  component: Menu,
  argTypes: {
    width: {
      control: 'number',
      description: 'Dropdown width in px',
    },
    position: {
      control: 'select',
      options: ['bottom-start', 'bottom-end', 'top-start', 'top-end', 'right-start', 'left-start'],
      description: 'Dropdown position relative to target',
    },
    withinPortal: {
      control: 'boolean',
      description: 'Render dropdown in portal',
    },
    closeOnItemClick: {
      control: 'boolean',
      description: 'Close dropdown after an item click',
    },
  },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'todo' },
  },
} satisfies Meta<StoryArgs>

export default meta

export const Default: Story = {
  args: {
    width: 220,
    position: 'bottom-end',
    withinPortal: false,
    closeOnItemClick: true,
  },
  render: (args) => {
    return (
      <div style={storyAreaStyle}>
        <Menu {...args}>
          <Menu.Target>
            <ActionIcon iconName='more' size='md' variant='transparent' aria-label='Open menu' />
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon name='edit' size='s' />}>Edit</Menu.Item>
            <Menu.Item leftSection={<Icon name='document' size='s' />}>Duplicate</Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<Icon name='close' size='s' />}>Delete</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    )
  },
}

export const TestDangerAction: Story = {
  args: {
    width: 220,
    withinPortal: false,
    closeOnItemClick: true,
    onDeleteClick: fn(),
    'data-testid': 'Menu-danger-test',
  },
  render: ({ onDeleteClick, 'data-testid': testId, ...args }) => {
    return (
      <div style={storyAreaStyle}>
        <Menu {...args}>
          <Menu.Target>
            <ButtonNew leftIcon='angle-down' size='md' variant='danger-secondary'>
              Test me now
            </ButtonNew>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon name='help' size='s' />}>Maybe delete</Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<Icon name='close' size='s' />} variant='danger'>
              Maybe possibly delete
            </Menu.Item>
            <Menu.Item
              leftSection={<Icon name='trash' size='s' />}
              onClick={onDeleteClick}
              data-testid={testId}
              variant='danger'
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    )
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /test me now/i }))
    await userEvent.click(canvas.getByTestId(args['data-testid']!))
    await expect(args.onDeleteClick).toHaveBeenCalledTimes(1)
  },
}
