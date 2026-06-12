import { Box, Group, type MantineSize, Pill, type PillProps, Stack, Title } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'

const pillVariants: Array<PillProps['variant']> = ['gray-light', 'amber-light']

const pillSizes: MantineSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

type Story = StoryObj<typeof Pill>

const meta: Meta<typeof Pill> = {
  title: 'Design system/Pill',
  component: Pill,
  argTypes: {
    variant: {
      description: 'Variant of pill',
      options: pillVariants,
      control: 'select',
    },
    size: {
      description: 'Size of pill',
      options: pillSizes,
      control: 'radio',
    },
    withRemoveButton: {
      description: 'Show remove button',
      control: 'boolean',
    },
  },
  parameters: { a11y: { test: 'todo' } },
}

export default meta

export const Default: Story = {
  args: {
    children: 'Pill label',
  },
}

/**
 * Display all pill variants and sizes
 */
export const PreviewAllVariants = () => (
  <>
    {pillVariants.map((variant) => (
      <Box key={variant} mb='lg'>
        <Title order={2} mb='md'>
          variant: <code>{variant}</code>
        </Title>
        <Group gap='lg' align='top'>
          {pillSizes.map((size) => (
            <Stack key={size} gap='sm'>
              <Title order={4}>
                size: <code>{size}</code>
              </Title>
              <Stack gap='xs'>
                <Pill variant={variant} size={size}>
                  Label
                </Pill>
                <Pill variant={variant} size={size} withRemoveButton>
                  With remove
                </Pill>
              </Stack>
            </Stack>
          ))}
        </Group>
      </Box>
    ))}
  </>
)
