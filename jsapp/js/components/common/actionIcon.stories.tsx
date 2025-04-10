import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import { IconNames } from '#/k-icons'
import ActionIcon, { type ActionIconProps } from './ActionIcon'

const actionIconVariants: Array<ActionIconProps['variant']> = [
  'filled',
  'light',

  //// Custom:
  'danger',
  'danger-secondary',
  'transparent',
]

const actionIconSizes: Array<ActionIconProps['size']> = ['sm', 'md', 'lg']

const meta: Meta<typeof ActionIcon> = {
  title: 'common/ActionIcon',
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

export default meta

type Story = StoryObj<typeof ActionIcon>

export const Default: Story = {
  args: {
    iconName: 'document',
    size: 'lg',
  },
}

export const Preview = () => (
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

export const TestClick: Story = {
  args: {
    variant: 'filled',
    size: 'md',
    iconName: 'edit',
    onClick: fn(),
    'data-testid': 'ActionIcon-click-test',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTestId('ActionIcon-click-test'))
    await expect((args as any).onClick).toHaveBeenCalled()
  },
}
