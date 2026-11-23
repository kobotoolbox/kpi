import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse, delay } from 'msw'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, within } from 'storybook/test'
import type { Asset } from '#/api/models/asset'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  getAssetsRetrieveMockHandler,
  getAssetsRetrieveResponseMock,
} from '#/api/react-query/manage-projects-and-library-content/msw'
import { getAssetsDataListMockHandler } from '#/api/react-query/survey-data/msw'
import permConfig from '#/components/permissions/permConfig'
import { endpoints } from '#/components/permissions/permParser.mocks'
import { meMockResponse } from '#/endpoints/me.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { ANON_USERNAME, buildUserUrl } from '#/users/utils'
import FormSummary from './index'

const ASSET_UID = 'aFormSummaryStory'
const EDITOR_USERNAME = 'jane_editor'

function buildPermission(username: string) {
  return {
    url: `/api/v2/assets/${ASSET_UID}/permission-assignments/${username}/`,
    user: buildUserUrl(username),
    permission: '/api/v2/permissions/view_asset/',
  }
}

/** A deployed project with submissions, owned by the story user and shared with one editor. */
function buildAsset(overrides: Partial<Asset> = {}): Asset {
  return getAssetsRetrieveResponseMock({
    uid: ASSET_UID,
    url: `/api/v2/assets/${ASSET_UID}/`,
    name: 'Household survey',
    owner__username: meMockResponse.username,
    owner_label: meMockResponse.username,
    last_modified_by: EDITOR_USERNAME,
    date_modified: '2026-11-10T10:00:00Z',
    deployment_status: 'deployed',
    has_deployment: true,
    deployment__active: true,
    deployment__submission_count: 12,
    deployed_versions: {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          uid: 'v1',
          url: '',
          content_hash: '',
          date_deployed: '2026-11-09T10:00:00Z',
          date_modified: '2026-11-09T10:00:00Z',
        },
      ],
    },
    summary: { row_count: 8, languages: ['English (en)', 'French (fr)'] },
    settings: {
      description: 'Yearly survey of household needs.',
      sector: { label: 'Humanitarian - Education', value: 'Humanitarian - Education' },
      country: [{ label: 'Kenya', value: 'KEN' }],
    },
    permissions: [
      buildPermission(meMockResponse.username),
      buildPermission(EDITOR_USERNAME),
      buildPermission(ANON_USERNAME),
    ],
    effective_permissions: [],
    ...overrides,
  })
}

const latestSubmissionHandler = getAssetsDataListMockHandler({
  count: 1,
  // Over a week old, so it shows as a date rather than e.g. "Yesterday"
  results: [{ _id: 1, end: '2026-11-03T08:30:00Z' } as unknown as DataResponse],
})

// The graph labels its days from today, so keep it loading for stable snapshots
const countsHandler = http.get('*/api/v2/assets/:uid/counts/', async () => {
  await delay('infinite')
  return HttpResponse.json({})
})

const otherHandlers = [latestSubmissionHandler, countsHandler]

const meta: Meta<typeof FormSummary> = {
  title: 'Features/FormSummary',
  component: FormSummary,
  // It's a page, docs view adds nothing
  tags: ['!autodocs'],
  decorators: [withRouter, queryClientDecorator],
  // `userCan` needs it for anyone but the owner
  beforeEach: () => {
    permConfig.setPermissions(endpoints.permissions.results)
  },
  parameters: {
    layout: 'fullscreen',
    reactRouter: reactRouterParameters({
      location: { path: ROUTES.FORM_SUMMARY.replace(':uid', ASSET_UID) },
      routing: { path: ROUTES.FORM_SUMMARY },
    }),
    msw: { handlers: [getAssetsRetrieveMockHandler(buildAsset()), ...otherHandlers] },
  },
}

export default meta
type Story = StoryObj<typeof FormSummary>

export const Owner: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Latest submission')
  },
}

export const NoSubmissions: Story = {
  parameters: {
    msw: {
      handlers: [getAssetsRetrieveMockHandler(buildAsset({ deployment__submission_count: 0 })), ...otherHandlers],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('navigation', { name: 'Quick Links' })
    await expect(canvas.queryByRole('navigation', { name: 'Data' })).not.toBeInTheDocument()
  },
}

export const Viewer: Story = {
  parameters: {
    msw: {
      handlers: [
        getAssetsRetrieveMockHandler(
          buildAsset({
            owner__username: EDITOR_USERNAME,
            owner_label: EDITOR_USERNAME,
            effective_permissions: [{ codename: 'view_asset' }],
          }),
        ),
        ...otherHandlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('navigation', { name: 'Quick Links' })
    // Neither in Quick Links nor next to Team members
    await expect(canvas.queryByRole('button', { name: 'Share project' })).not.toBeInTheDocument()
  },
}
