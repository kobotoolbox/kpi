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

const meta = {
  title: 'Design system/ActionIcon',
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
} satisfies Meta<typeof ActionIcon>

export default meta
type StoryArgs = ActionIconProps & { onClick?: () => void; 'data-testid'?: string }
type Story = StoryObj<typeof ActionIcon> & { args: StoryArgs }

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
    await userEvent.click(canvas.getByTestId(args.id!))
    // Unfortunately Storybook doesn't pass proper types for `args`, so we need to cast it.
    // TODO: I made an issue to point this out to Storybook team: https://github.com/storybookjs/storybook/issues/31106
    // let's fix this when they fix it.
    await expect((args as StoryArgs).onClick).toHaveBeenCalledTimes(1)
  },
}
