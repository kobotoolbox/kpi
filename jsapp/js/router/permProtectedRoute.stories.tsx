import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { RequestHandler } from 'msw'
import { http, HttpResponse } from 'msw'
import { Outlet, useLocation } from 'react-router-dom'
import { reactRouterOutlets, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, within } from 'storybook/test'
import { endpoints } from '#/api.endpoints'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { sessionAnonymousMock, sessionAuthenticatedMock } from '#/endpoints/allauth.mocks'
import { FeatureFlag } from '#/featureFlags'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import PermProtectedRoute from './permProtectedRoute'

// The gate every asset route sits behind, on a project settings deep link. These stories cover what it does once it
// has turned somebody away.

const ASSET_UID = 'aStoryAsset'

const SETTINGS_PATH = ROUTES.FORM_SETTINGS.replace(':uid', ASSET_UID)

/** Fails the asset request with `status`, which is what the gate reads. */
const assetRefusedMock = (status: number): RequestHandler =>
  http.get(endpoints.ASSET_URL, () => HttpResponse.json({ detail: 'Not found.' }, { status }))

/** Stands in for the login screen, printing the `next` it was handed so a story can check the way back. */
const LoginScreenStub = () => {
  const { search } = useLocation()
  return <h1>{`Login screen, back to: ${new URLSearchParams(search).get('next')}`}</h1>
}

const ProjectSettingsStub = () => <h1>Project settings</h1>

/** The addon renders the story at the parent route, so this is what the matched route lands in. */
const RouteHost = () => <Outlet />

const routing = reactRouterParameters({
  location: { path: SETTINGS_PATH },
  routing: reactRouterOutlets({ path: '/' }, [
    {
      path: ROUTES.FORM_SETTINGS,
      element: (
        <PermProtectedRoute
          requiredPermissions={[PERMISSIONS_CODENAMES.change_asset]}
          protectedComponent={ProjectSettingsStub}
        />
      ),
    },
    { path: AUTH_ROUTES.LOGIN, element: <LoginScreenStub /> },
  ]),
})

const meta: Meta<typeof RouteHost> = {
  title: 'Features/PermProtectedRoute',
  component: RouteHost,
  // Docs view can't render a routed page usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    reactRouter: routing,
  },
  // The flag decides whether there is an SPA login screen to send anybody to.
  beforeEach: () => {
    sessionStorage.setItem('feature_flags', JSON.stringify({ [FeatureFlag.authRedesignEnabled]: true }))
    return () => sessionStorage.removeItem('feature_flags')
  },
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof RouteHost>

/** A settings deep link opened with no session: signing in may be all it takes, so the login screen gets a turn. */
export const SignedOutGoesToLogin: Story = {
  parameters: { msw: { handlers: [assetRefusedMock(404), sessionAnonymousMock()] } },
  beforeEach: setAnonymousProfileForStories,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: `Login screen, back to: /#${SETTINGS_PATH}` })
    expect(canvas.queryByText('Access Denied')).not.toBeInTheDocument()
  },
}

/** `AccessDenied`'s support link has failed AA since long before this gate existed. */
const allowFailingLinkContrast = { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } }

/** Signed in and simply not allowed in. Nothing to sign in to, so the refusal stands. */
export const SignedInWithoutPermission: Story = {
  parameters: { ...allowFailingLinkContrast, msw: { handlers: [assetRefusedMock(404), sessionAuthenticatedMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('Access Denied')
    expect(canvas.queryByRole('heading', { level: 1, name: /Login screen/ })).not.toBeInTheDocument()
  },
}

/** A server error is nothing a session would fix, so even a visitor with none is shown what happened. */
export const ServerErrorKeepsTheRefusal: Story = {
  parameters: { ...allowFailingLinkContrast, msw: { handlers: [assetRefusedMock(500), sessionAnonymousMock()] } },
  beforeEach: setAnonymousProfileForStories,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('Something went wrong')
    expect(canvas.queryByRole('heading', { level: 1, name: /Login screen/ })).not.toBeInTheDocument()
  },
}
