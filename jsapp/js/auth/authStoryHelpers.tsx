import type { Decorator } from '@storybook/react'
import type { within } from 'storybook/test'

/** Helpers shared by the authentication screen stories */

/** What every play function starts from, named so helpers can take it. */
export type Canvas = ReturnType<typeof within>

/** Finds an input by its label (ignores required marker) */
export const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

/** Narrows the card enough to trip its container queries */
export const narrowViewportDecorator: Decorator = (Story) => <div style={{ width: 400 }}>{Story()}</div>
