import type { MantineSize, TooltipProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import { type IconName, IconNames } from '#/k-icons'
import Button, { type ButtonProps } from './ButtonNew'
import '@mantine/core/styles.css'
import type { ForwardRefExoticComponent } from 'react'
import type { StoryArgsFromPolymorphic } from '#/storybookUtils'

const buttonVariants: Array<ButtonProps['variant']> = [
  'filled',
  'light',
  // 'outline',
  // 'white',
  // 'subtle',
  // 'default',
  // 'gradient',

  //// Custom:
  'danger',
  'danger-secondary',
  'transparent',
]

const buttonSizes: MantineSize[] = [
  // 'xs',
  'sm',
  'md',
  'lg',
  // 'xl',
]

const tooltipPositions: Array<NonNullable<TooltipProps['position']>> = [
  'top',
  'right',
  'bottom',
  'left',
  'top-end',
  'top-start',
  'right-end',
  'right-start',
  'bottom-end',
  'bottom-start',
  'left-end',
  'left-start',
] as const

type StoryArgs = StoryArgsFromPolymorphic<'button', ButtonProps & { 'data-testid'?: string }>
type Story = StoryObj<ForwardRefExoticComponent<StoryArgs>>

const meta = {
  title: 'Design system/Button',
  component: Button,
  argTypes: {
    variant: {
      description: 'Variant of button',
      options: buttonVariants,
      control: 'select',
    },
    size: {
      description: 'Size of button',
      options: buttonSizes,
      control: 'radio',
    },
    tooltip: {
      description: 'Tooltip text',
      control: 'text',
    },
    tooltipProps: {
      description: 'Position of the tooltip (optional)',
      options: tooltipPositions,
      mapping: tooltipPositions
        .map((position) => [position, { position }] as const)
        .reduce((o, [k, v]) => {
          return { ...o, [k]: v }
        }, {}),
      control: 'radio',
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    fullWidth: {
      description: 'Makes the button take 100% width of the container',
      control: 'boolean',
    },
    leftIcon: {
      description: 'id of an icon',
      options: [undefined, ...Object.values(IconNames)],
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
    rightIcon: {
      description: 'id of an icon',
      options: [undefined, ...Object.values(IconNames)],
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
    leftSection: {
      table: {
        disable: true,
      },
    },
    rightSection: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<StoryArgs>

export default meta

export const Default: Story = {
  args: {
    variant: 'filled',
    size: 'lg',
    children: 'Click me',
  },
}

const demoButtons: Array<{ label?: string; leftIconName?: IconName }> = [
  {
    label: 'Click me',
    leftIconName: undefined,
  },
  {
    label: 'Click me',
    leftIconName: 'document',
  },
  //// For button without text use ActionIcon instead!
  // {
  //   label: undefined,
  //   leftIconName: 'document',
  // },
]

/**
 * We want to display a grid of all possible buttons:
 * - each type,
 * - in all sizes,
 * - with label x icon configurations,
 * - and in idle, pending, and disabled states.
 */
export const Preview = () => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, auto)',
      gridAutoFlow: 'row',
      gridGap: '30px 15px',
      justifyItems: 'start',
      padding: '10px',
    }}
  >
    {buttonVariants.map((variant) =>
      buttonSizes.map((size) =>
        demoButtons.map(({ label, leftIconName }) => {
          const buttonProps = {
            variant,
            size: size,
            leftIcon: leftIconName,
            onClick: () => console.info('Clicked!', variant, size, label, leftIconName),
            tooltip: label,
          } satisfies StoryArgs
          return (
            <>
              <Button {...buttonProps}>{label}</Button>
              <Button {...buttonProps} loading>
                {label}
              </Button>
              <Button {...buttonProps} disabled>
                {label}
              </Button>
            </>
          )
        }),
      ),
    )}
  </div>
)

export const TestClick: Story = {
  args: {
    children: 'Click me',
    onClick: fn(),
    'data-testid': 'Button-click-test',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTestId(args['data-testid']!))
    await expect(args.onClick).toHaveBeenCalledTimes(1)
  },
}

export const TestClickDisabled: Story = {
  args: {
    disabled: true,
    children: 'Click me',
    onClick: fn(),
    'data-testid': 'Button-click-test',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTestId(args['data-testid']!))
    await expect(args.onClick).toHaveBeenCalledTimes(0)
  },
}
