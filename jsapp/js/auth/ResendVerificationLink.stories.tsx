import type { Decorator } from '@storybook/react'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  emailConfirmationInvalidEmailMock,
  emailConfirmationRequestedMock,
  emailConfirmationThrottledMock,
} from '#/endpoints/emailConfirmation.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import ResendVerificationLink from './ResendVerificationLink'

/**
 * The "send me another confirmation email" control on its own. Two screens use it: one that already knows
 * the address, and one that has to ask for it.
 */

const EMAIL = 'caroline.herschel@kbtdev.org'

/** The server's answer, which is the same whether or not anybody holds that address. */
const SENT_MESSAGE = 'If that email address needs confirming, a new confirmation email has been sent to it.'

/** Roughly the width it gets inside the auth card */
const cardWidthDecorator: Decorator = (Story) => (
  <main style={{ maxWidth: 360, padding: 24 }}>
    <Story />
  </main>
)

// TODO: improve our button
const allowFailingButtonContrast = { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } }

const meta: Meta<typeof ResendVerificationLink> = {
  title: 'Components/ResendVerificationLink',
  component: ResendVerificationLink,
  args: { label: 'Resend activation link' },
  parameters: { msw: { handlers: [emailConfirmationRequestedMock()] } },
  decorators: [cardWidthDecorator, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof ResendVerificationLink>

/** No address known, so the field is there from the start. */
export const TypedAddress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Email'), EMAIL)
    await userEvent.click(canvas.getByRole('button', { name: 'Resend activation link' }))

    await canvas.findByText(SENT_MESSAGE)
    // The form goes with it, so there is nothing to submit a second time.
    expect(canvas.queryByLabelText('Email')).not.toBeInTheDocument()
  },
}

/** With `onSent` the caller shows the outcome instead, so this renders nothing of its own. */
export const HandsOffTheOutcome: Story = {
  args: { onSent: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Email'), EMAIL)
    await userEvent.click(canvas.getByRole('button', { name: 'Resend activation link' }))

    await waitFor(() => expect(args.onSent).toHaveBeenCalled())
    expect(canvas.queryByText(SENT_MESSAGE)).not.toBeInTheDocument()
  },
}

/** Our own validation, before anything is sent. */
export const InvalidAddress: Story = {
  parameters: allowFailingButtonContrast,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Email'), 'caroline.herschel')
    await userEvent.click(canvas.getByRole('button', { name: 'Resend activation link' }))

    await canvas.findByText('Please enter a valid email address')
    expect(canvas.getByLabelText('Email')).toBeInvalid()
  },
}

/** The address is already on screen, so one click is the whole flow. */
export const KnownAddress: Story = {
  args: { label: 'Request new link', email: EMAIL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Request new link' }))

    await canvas.findByText(SENT_MESSAGE)
    // Never asks for what it was handed.
    expect(canvas.queryByLabelText('Email')).not.toBeInTheDocument()
  },
}

/** The per-address hourly limit, reached. */
export const Throttled: Story = {
  args: { label: 'Request new link', email: EMAIL },
  parameters: { ...allowFailingButtonContrast, msw: { handlers: [emailConfirmationThrottledMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Request new link' }))

    await canvas.findByText(/Request was throttled/)
    // Still on offer: the limit is per hour, not permanent.
    expect(canvas.getByRole('button', { name: 'Request new link' })).toBeEnabled()
  },
}

/** An address the server will not take, even though our own pattern was happy with it. */
export const RejectedAddress: Story = {
  parameters: { ...allowFailingButtonContrast, msw: { handlers: [emailConfirmationInvalidEmailMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Email'), EMAIL)
    await userEvent.click(canvas.getByRole('button', { name: 'Resend activation link' }))

    // Under the input rather than in a banner, since that is the thing to change.
    await canvas.findByText('Enter a valid email address.')
    expect(canvas.getByLabelText('Email')).toBeInvalid()
    // Still holding what was typed, so it can be corrected rather than retyped.
    expect(canvas.getByLabelText('Email')).toHaveValue(EMAIL)
  },
}
