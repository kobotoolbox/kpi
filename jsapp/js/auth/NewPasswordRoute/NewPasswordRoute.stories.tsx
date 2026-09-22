import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import {
  PASSWORD_RESET_URL,
  passwordResetDoneAndSignedInMock,
  passwordResetErrorsMock,
  passwordResetKeyConflictMock,
  passwordResetKeyInvalidMock,
  passwordResetKeyValidMock,
} from '#/endpoints/allauth.mocks'
import { makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'
import NewPasswordRoute from './NewPasswordRoute'

const RESET_KEY = 'a-good-key'
const NEW_PASSWORD = 'correct horse battery staple'

const environmentMock = makeEnvironmentMock()

/** Where {@link resetRecordingMock} leaves the body it saw, for a story to check the key of. */
let postedBody: unknown = null

/** Keeps the request body: the key goes from URL to POST without being rendered, so only this can show it arrived. */
const resetRecordingMock = () =>
  http.post(PASSWORD_RESET_URL, async ({ request }) => {
    postedBody = await request.json()
    return HttpResponse.json(
      { status: 401, data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } },
      { status: 401 },
    )
  })

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding a reset handler still
 * has to restate `/environment` and the key lookup that puts the form on screen.
 */
const storyHandlers = (options?: { environment?: RequestHandler; keyCheck?: RequestHandler; reset?: RequestHandler }) =>
  [options?.environment ?? environmentMock, options?.keyCheck ?? passwordResetKeyValidMock(), options?.reset].filter(
    (handler): handler is RequestHandler => Boolean(handler),
  )

/** Renders the story as `/auth/reset-password/:key`, so the route really reads its key off the URL. */
const newPasswordRouting = (key: string) =>
  reactRouterParameters({
    location: { path: `${ROUTES.AUTH_ROOT}/reset-password/${key}` },
    routing: reactRouterOutlet(
      { path: ROUTES.AUTH_ROOT },
      { path: 'reset-password/:key', element: <NewPasswordRoute /> },
    ),
  })

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/NewPasswordRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: newPasswordRouting(RESET_KEY),
  },
  // Nobody is logged in when they are recovering a password.
  beforeEach: setAnonymousSessionForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

type Canvas = ReturnType<typeof within>

/** Finds an input by its label */
const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Change password' }))

/** Waits for the key lookup to put the form on screen, then fills both fields with matching passwords */
async function fillForm(canvas: Canvas, { confirm = NEW_PASSWORD } = {}) {
  await userEvent.type(await canvas.findByLabelText(/^New password/), NEW_PASSWORD)
  await userEvent.type(field(canvas, 'Confirm password'), confirm)
}

export const Default: Story = {}

/** The main flow */
export const PasswordChanged: Story = {
  parameters: { msw: { handlers: storyHandlers({ reset: resetRecordingMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    postedBody = null

    await fillForm(canvas)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Password has been successfully changed.' })
    // The whole form is replaced, so a password that is already changed cannot be submitted twice.
    expect(canvas.queryByLabelText(/^New password/)).not.toBeInTheDocument()
    expect(canvas.getByRole('link', { name: 'Go back to Login' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)

    // The key came off the URL and went out in the body, which nothing on screen shows.
    expect(postedBody).toEqual({ key: RESET_KEY, password: NEW_PASSWORD })
  },
}

/** The same reset where the server signs the account in on its way out: nothing left to log into. */
export const PasswordChangedAndSignedIn: Story = {
  parameters: { msw: { handlers: storyHandlers({ reset: passwordResetDoneAndSignedInMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await fillForm(canvas)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Password has been successfully changed.' })
    // A plain `href`, so the click leaves `/auth` and loads the app with the session allauth just handed out.
    expect(canvas.getByRole('link', { name: 'Continue to KoboToolbox' })).toHaveAttribute('href', '/')
  },
}

/** Nothing filled in, then a confirmation that does not match - neither reaches the server. */
export const ClientValidation: Story = {
  parameters: { msw: { handlers: storyHandlers({ reset: resetRecordingMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    postedBody = null

    await canvas.findByLabelText(/^New password/)
    await submit(canvas)
    // The rules themselves are unit tested in `authValidation.tests`
    expect(await canvas.findAllByText('Required field')).toHaveLength(2)

    await fillForm(canvas, { confirm: 'something else entirely' })
    await submit(canvas)
    await canvas.findByText('You must type the same password each time.')

    expect(postedBody).toBe(null)
  },
}

/** A password the server refused. Those rules are Django validators gated on settings, so the client never guesses. */
export const ServerRejectsPassword: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        reset: passwordResetErrorsMock([
          { code: 'password_too_common', param: 'password', message: 'This password is too common.' },
          { code: 'invalid', message: 'Please pick a different password.' },
        ]),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await fillForm(canvas)
    await submit(canvas)

    // Field error - under the input it is about.
    await canvas.findByText('This password is too common.')
    // General error - above the form.
    await canvas.findByText('Please pick a different password.')
    // Still on the form, so a second password costs two fields rather than another email.
    expect(canvas.getByLabelText(/^New password/)).toBeInTheDocument()
  },
}

/** A link that was already dead when it was opened, so the form is never offered. */
export const InvalidKey: Story = {
  parameters: { msw: { handlers: storyHandlers({ keyCheck: passwordResetKeyInvalidMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Password reset failed' })
    expect(canvas.queryByLabelText(/^New password/)).not.toBeInTheDocument()
    expect(canvas.getByRole('link', { name: 'Go back to Login' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)
  },
}

/** A reset link opened in a browser that is already signed in - allauth answers 409 and refuses. */
export const AlreadyLoggedIn: Story = {
  parameters: { msw: { handlers: storyHandlers({ keyCheck: passwordResetKeyConflictMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'You are already logged in' })
    // A plain `href`, so the click leaves `/auth` and loads the app with the session that was there.
    expect(canvas.getByRole('link', { name: 'Continue to KoboToolbox' })).toHaveAttribute('href', '/')
  },
}
