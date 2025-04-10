import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import React from 'react'
import { IconNames } from '#/k-icons'
import ActionIcon, { type ActionIconProps } from './ActionIcon'

/**
 * Storybook:
 * - design system (for Mantine wrappers)
 * - design system old (for inhouse components)
 * - components (re-used sub-features)
 * - feature/container
 *   - sub-feature/container
 *     - ...
 *
 * Story:
 * - "Docs" (custom args)
 * - "Preview" (big table of most used args at a glance, similar to Figma's big table)
 * - Test: Asdf
 * - Test: Foo
 * - ...
 */

const actionIconVariants: Array<ActionIconProps['variant']> = [
  'filled',
  'light',

  //// Custom:
  'danger',
  'danger-secondary',
  'transparent',
]

const actionIconSizes: Array<ActionIconProps['size']> = ['sm', 'md', 'lg']

export default {
  title: 'common/Action Icon',
  component: ActionIcon,
  argTypes: {
    variant: {
      description: 'Variant of action icon',
      options: actionIconVariants,
      control: 'select',
    },
    size: {
      description: 'Size of action icon',
      options: actionIconSizes,
      control: 'radio',
    },
    iconName: {
      description: 'Icon',
      options: Object.keys(IconNames),
      control: { type: 'select' },
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
} as Meta<typeof ActionIcon>

type Story = StoryObj<typeof ActionIcon>

export const Filled: Story = {
  args: {
    variant: 'filled',
    size: 'md',
    iconName: 'edit',
    onClick: fn(),
    ...({ 'data-testid': 'testId' } as any),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTestId('testId'))
    await expect((args as any).onClick).toHaveBeenCalled()
  },
}

export const Light: Story = {
  args: {
    variant: 'light',
    size: 'md',
    iconName: 'edit',
  },
}

export const Transparent: Story = {
  args: {
    variant: 'transparent',
    size: 'md',
    iconName: 'more',
  },
}

export const Danger: Story = {
  args: {
    variant: 'danger',
    size: 'md',
    iconName: 'trash',
  },
}

export const DangerSecondary: Story = {
  args: {
    variant: 'danger-secondary',
    size: 'lg',
    iconName: 'trash',
  },
}

export const AllIconStyles = () => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, auto)',
      gridAutoFlow: 'row',
      gridGap: '30px 15px',
      justifyItems: 'start',
      padding: '10px',
    }}
  >
    {actionIconVariants.map((variant) =>
      actionIconSizes.map((size) => {
        const actionIconProps: ActionIconProps = {
          variant,
          size: size,
          iconName: 'more',
        }
        return (
          <>
            <ActionIcon {...actionIconProps} />
            <ActionIcon {...actionIconProps} loading />
            <ActionIcon {...actionIconProps} disabled />
          </>
        )
      }),
    )}
  </div>
)
