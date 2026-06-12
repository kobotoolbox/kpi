import { Box, Group, type MantineSize, Stack, Title, type TooltipProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react'
import type { ForwardRefExoticComponent } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { type IconName, IconNames } from '#/k-icons'
import type { StoryArgsFromPolymorphic } from '#/storybookUtils'
import { recordValues } from '#/utils'
import Button, { type ButtonProps } from './ButtonNew'

const buttonVariants: Array<ButtonProps['variant']> = [
  'filled',
  'light',
  'outline',
  'transparent',
  // 'white',
  // 'subtle',
  // 'default',
  // 'gradient',

  //// Custom:
  'danger',
  'danger-secondary',
  'danger-transparent',
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

const tablerIconOptions = {
  IconSearch,
  IconX,
  IconChevronDown,
} as const

const legacyIconOptions = recordValues(IconNames)
const iconSelectOptions = [undefined, ...legacyIconOptions, ...Object.keys(tablerIconOptions)]
const iconSelectMapping = iconSelectOptions
  .filter((option) => option !== undefined)
  .reduce<Record<string, ButtonProps['leftIcon']>>((acc, option) => {
    if (option in tablerIconOptions) {
      acc[option] = tablerIconOptions[option as keyof typeof tablerIconOptions]
      return acc
    }

    acc[option] = option as IconName
    return acc
  }, {})

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
      description: 'Legacy icon id or Tabler icon component',
      options: iconSelectOptions,
      mapping: iconSelectMapping,
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
    rightIcon: {
      description: 'Legacy icon id or Tabler icon component',
      options: iconSelectOptions,
      mapping: iconSelectMapping,
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
  parameters: {
    a11y: { test: 'todo' },
    docs: {
      description: {
        component:
          'Section precedence: `leftSection` and `rightSection` override icon props when provided. Otherwise `leftIcon`/`rightIcon` are rendered via KoboIcon and can be either legacy icon names or Tabler icon components.',
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

export const DefaultWithTablerIcon: Story = {
  args: {
    variant: 'filled',
    size: 'lg',
    children: 'Click me',
    leftIcon: IconSearch,
  },
}

const demoButtons: Array<{ label?: string; leftIcon?: ButtonProps['leftIcon'] }> = [
  {
    label: 'No icon',
    leftIcon: undefined,
  },
  {
    label: 'Legacy icon',
    leftIcon: 'document',
  },
  {
    label: 'Tabler icon',
    leftIcon: IconSearch,
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
export const PreviewAllVariants = () => (
  <>
    {buttonVariants.map((variant) => (
      <Box key={variant} mb='lg'>
        <Title order={2} mb='md'>
          variant: <code>{variant}</code>
        </Title>
        <Group gap='lg' align='top'>
          {buttonSizes.map((size) => (
            <Stack key={size} gap='sm'>
              <Title order={4}>
                size: <code>{size}</code>
              </Title>
              <Group gap='xs'>
                {demoButtons.map(({ label, leftIcon }, index) => {
                  const buttonProps = {
                    variant,
                    size: size,
                    leftIcon,
                    onClick: () => console.info('Clicked!', variant, size, label, leftIcon),
                  } satisfies StoryArgs
                  return (
                    <Stack gap='xs'>
                      <Button key={`${index}-normal`} {...buttonProps}>
                        {label}
                      </Button>
                      <Button key={`${index}-loading`} {...buttonProps} loading>
                        {label}
                      </Button>
                      <Button key={`${index}-disabled`} {...buttonProps} disabled>
                        {label}
                      </Button>
                    </Stack>
                  )
                })}
              </Group>
            </Stack>
          ))}
        </Group>
      </Box>
    ))}
  </>
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
