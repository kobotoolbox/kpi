import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, userEvent, within } from 'storybook/test'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import { getApiV2AssetsPairedDataListMockHandler } from '#/api/react-query/survey-data/msw'
import { getApiV2OrganizationsAssetsMinimalListRetrieveMockHandler } from '#/api/react-query/user-team-organization-usage/msw'
import type { AssetResponse } from '#/dataInterface'
import assetsMock from '#/endpoints/assets.mocks'
import meMock from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import ConnectProjects from './connectProjects'

const asset = getApiV2AssetsRetrieveResponseMock({
  uid: 'aChildForm',
  name: 'Child form',
  data_sharing: { enabled: false, fields: [] },
  content: { survey: [] },
}) as unknown as AssetResponse

const userSharedAsset = getApiV2AssetsRetrieveResponseMock({
  uid: 'aUserShared',
  name: 'Shared with me',
  url: 'http://kf.kobo.local/api/v2/assets/aUserShared/',
}) as unknown as AssetResponse

const handlers = [
  meMock,
  assetsMock({ count: 1, results: [userSharedAsset] }),
  getApiV2AssetsPairedDataListMockHandler({ count: 0, next: null, previous: null, results: [] }),
  getApiV2OrganizationsAssetsMinimalListRetrieveMockHandler({
    next: null,
    previous: null,
    results: [
      // Also in the user list, should show once
      { uid: 'aUserShared', name: 'Shared with me', deployment_status: 'deployed' },
      { uid: 'aParentForm', name: 'Org parent form', deployment_status: 'deployed' },
    ],
  }),
]

const meta: Meta<typeof ConnectProjects> = {
  title: 'Features/ConnectProjects',
  component: ConnectProjects,
  tags: ['!autodocs'],
  args: { asset },
  decorators: [queryClientDecorator],
  parameters: { a11y: { disable: true } },
}

export default meta
type Story = StoryObj<typeof ConnectProjects>

async function openProjectSelect(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByPlaceholderText('Select a different project to import data from'))
  return within(canvasElement.ownerDocument.body)
}

/** Non-MMO account: only projects from `/assets/` are listed. */
export const Default: Story = {
  parameters: { msw: { handlers: [organizationMock(), ...handlers] } },
  play: async ({ canvasElement }) => {
    const body = await openProjectSelect(canvasElement)
    await expect(await body.findByRole('option', { name: 'Shared with me' })).toBeInTheDocument()
    await expect(body.queryByRole('option', { name: 'Org parent form' })).not.toBeInTheDocument()
  },
}

/** MMO owner: org projects are listed too, without duplicates. */
export const OrganizationOwner: Story = {
  parameters: { msw: { handlers: [organizationMock({ is_mmo: true, request_user_role: 'owner' }), ...handlers] } },
  play: async ({ canvasElement }) => {
    const body = await openProjectSelect(canvasElement)
    await expect(await body.findByRole('option', { name: 'Org parent form' })).toBeInTheDocument()
    await expect(body.getAllByRole('option', { name: 'Shared with me' })).toHaveLength(1)
  },
}

/** MMO member: no access to org assets endpoint. */
export const OrganizationMember: Story = {
  parameters: { msw: { handlers: [organizationMock({ is_mmo: true, request_user_role: 'member' }), ...handlers] } },
  play: Default.play,
}
