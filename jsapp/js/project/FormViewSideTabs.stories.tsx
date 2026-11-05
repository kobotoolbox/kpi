import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
import type { Asset } from '#/api/models/asset'
import {
  getAssetsRetrieveMockHandler,
  getAssetsRetrieveResponseMock,
} from '#/api/react-query/manage-projects-and-library-content/msw'
import { meMockResponse } from '#/endpoints/me.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import FormViewSideTabs from './FormViewSideTabs'

const ASSET_UID = 'aFormViewSideTabsStory'

function buildAsset(overrides: Partial<Asset> = {}): Asset {
  return getAssetsRetrieveResponseMock({
    uid: ASSET_UID,
    owner__username: meMockResponse.username,
    has_deployment: true,
    deployment__active: true,
    deployed_versions: { count: 1, next: null, previous: null, results: [] },
    permissions: [],
    effective_permissions: [],
    ...overrides,
  })
}

function atRoute(route: string) {
  return reactRouterParameters({
    location: { path: route.replace(':uid', ASSET_UID) },
    routing: { path: `${ROUTES.FORM}/*` },
  })
}

async function expectTabs(canvasElement: HTMLElement, labels: string[]) {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getAllByRole('link').map((link) => link.textContent)).toEqual(labels))
}

const SETTINGS_TABS_ALL = ['General', 'Media', 'Sharing', 'Connect Projects', 'REST Services', 'Activity']

const meta: Meta<typeof FormViewSideTabs> = {
  title: 'Features/FormViewSideTabs',
  component: FormViewSideTabs,
  // It's a page-level layout part, docs view adds nothing
  tags: ['!autodocs'],
  decorators: [
    withRouter,
    queryClientDecorator,
    (Story) => (
      // The global styles size the tabs against the page height
      <div style={{ height: 400 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    reactRouter: atRoute(ROUTES.FORM_TABLE),
    msw: { handlers: [getAssetsRetrieveMockHandler(buildAsset())] },
  },
}

export default meta
type Story = StoryObj<typeof FormViewSideTabs>

export const DataTabs: Story = {
  play: async ({ canvasElement }) => {
    await expectTabs(canvasElement, ['Table', 'Reports', 'Gallery', 'Downloads', 'Map'])
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Table' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('link', { name: 'Reports' })).not.toHaveAttribute('aria-current')
  },
}

export const SettingsTabs: Story = {
  parameters: {
    reactRouter: atRoute(ROUTES.FORM_SETTINGS),
  },
  play: async ({ canvasElement }) => {
    await expectTabs(canvasElement, SETTINGS_TABS_ALL)
    await expect(within(canvasElement).getByRole('link', { name: 'General' })).toHaveAttribute('aria-current', 'page')
  },
}

export const SettingsTabsDraft: Story = {
  parameters: {
    reactRouter: atRoute(ROUTES.FORM_SETTINGS),
    msw: {
      handlers: [
        getAssetsRetrieveMockHandler(
          buildAsset({
            has_deployment: false,
            deployment__active: false,
            deployed_versions: { count: 0, next: null, previous: null, results: [] },
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expectTabs(
      canvasElement,
      SETTINGS_TABS_ALL.filter((label) => label !== 'REST Services'),
    )
  },
}

export const SettingsTabsForEditor: Story = {
  parameters: {
    reactRouter: atRoute(ROUTES.FORM_MEDIA),
    msw: {
      handlers: [
        getAssetsRetrieveMockHandler(
          buildAsset({
            owner__username: 'someone_else',
            effective_permissions: [{ codename: 'view_asset' }, { codename: 'change_asset' }],
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expectTabs(canvasElement, ['General', 'Media'])
    await expect(within(canvasElement).getByRole('link', { name: 'Media' })).toHaveAttribute('aria-current', 'page')
  },
}
