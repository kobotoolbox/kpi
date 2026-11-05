import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, userEvent, within } from 'storybook/test'
import { logoutServerErrorMock } from '#/endpoints/allauth.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import InvalidatedPassword from './invalidatedPassword.component'

/** The blocker for accounts an admin flagged as having an insecure password. */
const meta: Meta<typeof InvalidatedPassword> = {
  title: 'Features/InvalidatedPassword',
  component: InvalidatedPassword,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof InvalidatedPassword>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByRole('button', { name: 'Save Password' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Logout' })).toBeEnabled()
  },
}

/** Logout failed: said on the card, since the user is stuck otherwise. */
export const LogoutFails: Story = {
  parameters: { msw: { handlers: [logoutServerErrorMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Logout' }))

    expect(await canvas.findByText('Could not log you out. Please try again later.')).toBeInTheDocument()
  },
}
