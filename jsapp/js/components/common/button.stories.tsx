import type { Meta, StoryObj } from '@storybook/react'
import { type IconName, IconNames } from 'jsapp/fonts/k-icons'
import type { MantineSize, PolymorphicComponentProps, TooltipProps } from '@mantine/core'
import Icon from './icon'
import '@mantine/core/styles.css'
import Button, { type ButtonProps } from './ButtonNew'

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
    leftSection: {
      description:
        'For preview only, here\'s a full list of existing icons to be rendered in size "m". In practice, anything *could* be rendered in the left section, but we *should* agree on using only icons.',
      options: [undefined, ...Object.values(IconNames)],
      mapping: Object.fromEntries(
        Object.values(IconNames).map((iconName) => [iconName, <Icon name={iconName} size='m' />]),
      ),
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
    rightSection: {
      description:
        'For preview only, here\'s a full list of existing icons to be rendered in size "m". In practice, anything *could* be rendered in the left section, but we *should* agree on using only icons.',
      options: [undefined, ...Object.values(IconNames)],
      mapping: Object.fromEntries(
        Object.values(IconNames).map((iconName) => [iconName, <Icon name={iconName} size='m' />]),
      ),
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
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

/**
 * This story demonstrates how to use the `leftSection` and `rightSection` props to render icons.
 *
 * Note: remember to **use the same size** for the icon as you use for the Button itself.
 */
export const WithIcon = () => (
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
    <Button variant='filled' size='sm' leftSection={<Icon name='download' size='s' />}>
      Download
    </Button>
    <Button variant='light' size='md' leftSection={<Icon name='file' size='m' />}>
      XLSForm file
    </Button>
    <Button variant='danger' size='lg' rightSection={<Icon name='trash' size='l' />}>
      Delete
    </Button>
    <Button variant='danger-secondary' size='sm' leftSection={<Icon name='close' size='s' />}>
      Close this window
    </Button>
  </div>
)

const demoButtons: Array<{ label?: string; leftSectionName?: IconName }> = [
  {
    label: 'Click me',
    leftSectionName: undefined,
  },
  {
    label: 'Click me',
    leftSectionName: 'document',
  },
  //// For button without text use ActionIcon instead!
  // {
  //   label: undefined,
  //   leftSectionName: 'document',
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
        demoButtons.map(({ label, leftSectionName }) => {
          const buttonProps: PolymorphicComponentProps<'button', ButtonProps> = {
            variant,
            size: size,
            leftSection: leftSectionName ? <Icon name={leftSectionName} size={size[0] as any} /> : undefined,
            onClick: () => console.info('Clicked!', variant, size, label, leftSectionName),
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
