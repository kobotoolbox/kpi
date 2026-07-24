import type { ElementProps } from '@mantine/core'
import type { Decorator } from '@storybook/react'
import type { CSSProperties, ElementType } from 'react'

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

/**
 * Wraps stories in a container with minimum height. Useful for components that:
 * - Open dropdown menus that need space to render
 * - Display maps that require non-auto height parents
 * - Show modals or popovers that extend beyond typical content bounds
 */
export const withMinHeightWrapper = (minHeight: number, additionalStyles?: CSSProperties): Decorator =>
  ((Story) => (
    <div
      style={{
        minHeight,
        padding: 'var(--mantine-spacing-lg)',
        overflow: 'visible',
        ...additionalStyles,
      }}
    >
      <Story />
    </div>
  )) as Decorator
