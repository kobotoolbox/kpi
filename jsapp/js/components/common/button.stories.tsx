import type { MantineSize, PolymorphicComponentProps, TooltipProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'
import { type IconName, IconNames } from '#/k-icons'
import Button, { type ButtonProps } from './ButtonNew'
import '@mantine/core/styles.css'

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

const meta: Meta<typeof Button> = {
  title: 'common/Button',
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
}

export default meta

type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: {
    variant: 'filled',
    size: 'lg',
    children: 'Click me',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'light',
    size: 'lg',
    children: 'Click me',
  },
}

export const Danger: Story = {
  args: {
    variant: 'danger',
    size: 'lg',
    children: 'Click me',
  },
}

export const SecondaryDanger: Story = {
  args: {
    variant: 'danger-secondary',
    size: 'lg',
    children: 'Click me',
  },
}

export const Text: Story = {
  args: {
    variant: 'transparent',
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
export const AllButtons = () => (
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
          const buttonProps: PolymorphicComponentProps<'button', ButtonProps> = {
            variant,
            size: size,
            leftIcon: leftIconName,
            onClick: () => console.info('Clicked!', variant, size, label, leftIconName),
            tooltip: label,
          }
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
