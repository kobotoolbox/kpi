import type { Decorator } from '@storybook/react'
import { expect, type within } from 'storybook/test'

/** Helpers shared by the authentication screen stories */

/** What every play function starts from, named so helpers can take it. */
export type Canvas = ReturnType<typeof within>

/** Finds an input by its label (ignores required marker) */
export const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

/** Like {@link field}, but waits for the input to render */
export const findField = (canvas: Canvas, label: string) => canvas.findByLabelText(new RegExp(`^${label}`))

/** Narrows the card enough to trip its container queries */
export const narrowViewportDecorator: Decorator = (Story) => <div style={{ width: 400 }}>{Story()}</div>

/** Expects buttons for the first three `socialAppsMock` providers, not the fourth. Returns the first one. */
export async function findProviderButtons(canvas: Canvas) {
  const firstButton = await canvas.findByRole('button', { name: 'Continue with GitLab' })
  expect(canvas.getByRole('button', { name: 'Continue with Example Organization' })).toBeInTheDocument()
  expect(canvas.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  expect(canvas.queryByRole('button', { name: 'Continue with Microsoft' })).not.toBeInTheDocument()
  return firstButton
}
