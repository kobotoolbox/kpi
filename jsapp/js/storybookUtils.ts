import type { ElementProps } from '@mantine/core'
import type { ElementType } from 'react'

/**
 * For polymorphic components Storybook fails to infer props, use this helper to make StoryArgs you need.
 *
 * Example:
 * ```
 * type StoryArgs = StoryArgsFromPolymorphic<'button', ButtonProps & { 'data-testid'?: string }>
 * type Story = StoryObj<React.ForwardRefExoticComponent<StoryArgs>>
 * ```
 */
export type StoryArgsFromPolymorphic<C extends ElementType, P extends object> = P &
  ElementProps<C, Extract<keyof P, string>>
