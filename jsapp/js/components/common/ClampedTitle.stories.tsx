import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import ClampedTitle from './ClampedTitle'

const LONG_NAME =
  'Sharing Permissions: Multi-Sectoral Needs Assessment for Displaced Households in the Northern Region 2026 (Round 4, Revised)'

/**
 * Clamps a heading to a fixed number of lines. Resize the container to see the
 * clamp adapt without any JS measuring.
 */
const meta: Meta<typeof ClampedTitle> = {
  title: 'Design system/ClampedTitle',
  component: ClampedTitle,
  argTypes: {
    lines: {
      description: 'How many lines to display before truncating',
      control: { type: 'number', min: 1, max: 5 },
    },
    children: {
      description: 'Text to clamp',
      type: 'string',
    },
  },
  args: {
    children: LONG_NAME,
    lines: 2,
  },
  // Rendered at modal title size so the stories match real usage.
  decorators: [
    (Story) => (
      <Box w={420} fz='xl' fw={500} style={{ resize: 'horizontal', overflow: 'auto' }}>
        <Story />
      </Box>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ClampedTitle>

export const TwoLines: Story = {}

export const OneLine: Story = {
  args: { lines: 1 },
}

/** Short text is left alone - no ellipsis, no reserved space. */
export const ShortText: Story = {
  args: { children: 'Sharing Permissions: My project' },
}

/** A name with no spaces must wrap mid-word rather than overflow the container. */
export const NoSpaces: Story = {
  args: {
    children: `Delete project "${'unbroken-project-name-that-never-wraps'.repeat(3)}"`,
  },
}
