import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import { within } from 'storybook/test'
import { getAssetsRetrieveMockHandler } from '#/api/react-query/manage-projects-and-library-content/msw'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { SIDE_TABS_ASSET_UID, buildSideTabsAsset, sideTabsRouteParameters } from './FormViewSideTabs.mocks'
import ProjectLayout from './ProjectLayout'

const CONTAINER_HEIGHT = 500

/** A page taller than the layout, with the root class of a real one. */
function TallPage(props: { className: string }) {
  return (
    <div className={props.className} data-testid='page'>
      {Array.from({ length: 60 }, (_, index) => (
        <p key={index}>{`Row ${index + 1}`}</p>
      ))}
      {/* Like real pages, something to focus in the scrolling area */}
      <button type='button'>{'Action'}</button>
    </div>
  )
}

function atRoute(route: string) {
  return {
    reactRouter: sideTabsRouteParameters(route),
    // `ProjectTopTabs` reads the uid from the hash, not the router
    hashPath: route.replace(':uid', SIDE_TABS_ASSET_UID),
  }
}

/** Measures the layout, once both menus have loaded (the side one only if expected). */
async function getLayout(canvasElement: HTMLElement, hasSideMenu: boolean) {
  const canvas = within(canvasElement)
  const topTabs = (await canvas.findByRole('link', { name: /summary/i })).closest('nav')!
  const sideMenu = hasSideMenu ? await canvas.findByRole('navigation', { name: 'Data' }) : null
  const page = canvas.getByTestId('page')
  return {
    container: canvasElement.querySelector<HTMLElement>('[data-testid="container"]')!.getBoundingClientRect(),
    topTabs: topTabs.getBoundingClientRect(),
    sideMenu: sideMenu?.getBoundingClientRect(),
    page,
    pageRect: page.getBoundingClientRect(),
    pageArea: page.parentElement!,
  }
}

const meta: Meta<typeof ProjectLayout> = {
  title: 'Features/ProjectLayout',
  component: ProjectLayout,
  tags: ['!autodocs'],
  decorators: [
    withRouter,
    queryClientDecorator,
    (Story) => (
      // Stands in for `.mdl-layout__content`
      <div data-testid='container' style={{ height: CONTAINER_HEIGHT }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    ...atRoute(ROUTES.FORM_TABLE),
    msw: { handlers: [getAssetsRetrieveMockHandler(buildSideTabsAsset())] },
  },
  beforeEach: ({ parameters }) => {
    window.location.hash = parameters.hashPath
    return () => {
      window.location.hash = ''
    }
  },
}

export default meta
type Story = StoryObj<typeof ProjectLayout>

export const DataPage: Story = {
  args: { children: <TallPage className='form-view' /> },
}

export const LandingPage: Story = {
  parameters: atRoute(ROUTES.FORM_LANDING),
  args: { children: <TallPage className='form-view' /> },
}

export const SettingsPage: Story = {
  parameters: atRoute(ROUTES.FORM_SETTINGS),
  args: { children: <TallPage className='form-view' /> },
}
