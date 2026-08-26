import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { runInAction } from 'mobx'
import { expect, waitFor, within } from 'storybook/test'
import { getApiV2TermsOfServiceListMockHandler } from '#/api/react-query/other/msw'
import organizationMock from '#/endpoints/organization.mocks'
import envStore, { type UserMetadataField } from '#/envStore'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { RequireOrg } from '#/router/RequireOrg'
import TOSForm from './tosForm.component'

// The form only renders *required* user metadata fields, so we mark the org
// fields as required here to actually exercise the MMO logic. `beforeEach`
// restores the original values so other stories aren't affected.
const REQUIRED_FIELDS_WITH_ORG: UserMetadataField[] = [
  { name: 'name', required: true, label: 'Full name' },
  { name: 'organization_type', required: true, label: 'Organization type' },
  { name: 'organization', required: true, label: 'Organization name' },
  { name: 'organization_website', required: true, label: 'Organization website' },
]

// A minimal announcement so the form gets past its loading guard. Without a
// message whose slug is `terms_of_service` the form would spin forever.
const termsOfServiceMock = getApiV2TermsOfServiceListMockHandler([
  {
    url: 'http://kf.kobo.local/api/v2/terms-of-service/terms_of_service/',
    slug: 'terms_of_service',
    body: '<p>Please accept our Terms of Service.</p>',
  },
])

const meta: Meta<typeof TOSForm> = {
  title: 'Components/TOSForm',
  component: TOSForm,
  // Docs view doesn't work :sadface: :angryface: --> turning it off
  tags: ['!autodocs'],
  parameters: {
    msw: {
      handlers: [termsOfServiceMock, organizationMock()],
    },
    // The injected TOS message and heading order trip a11y checks that are not
    // relevant to what these stories demonstrate.
    a11y: { disable: true },
  },
  beforeEach: async () => {
    // `envStore` fires a one-shot `fetchData()` on import that resolves against
    // the global environment mock and *overwrites* `user_metadata_fields`. If we
    // seed our fields before that request settles, it clobbers them mid-render.
    // Wait for it to land first — after this there is no further fetch to undo
    // our values.
    await waitFor(() => expect(envStore.isReady).toBe(true)).catch(() => {})

    const original = { isReady: envStore.isReady, fields: envStore.data.user_metadata_fields }
    runInAction(() => {
      envStore.isReady = true
      envStore.data.user_metadata_fields = REQUIRED_FIELDS_WITH_ORG
    })
    return () => {
      runInAction(() => {
        envStore.isReady = original.isReady
        envStore.data.user_metadata_fields = original.fields
      })
    }
  },
  decorators: [
    (Story) => (
      <RequireOrg>
        <Story />
      </RequireOrg>
    ),
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof TOSForm>

/** A regular user sees the organization fields alongside the other required fields. */
export const NonMmoMember: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /i agree/i })

    expect(canvas.getByText(/full name/i)).toBeInTheDocument()
    expect(canvas.getByText(/organization name/i)).toBeInTheDocument()
  },
}

/** MMO members can't edit org fields (managed at the org level), so they're hidden. See DEV-2580. */
export const MmoMember: Story = {
  parameters: {
    msw: {
      handlers: [termsOfServiceMock, organizationMock({ is_mmo: true })],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /i agree/i })

    expect(canvas.getByText(/full name/i)).toBeInTheDocument()
    expect(canvas.queryByText(/organization name/i)).not.toBeInTheDocument()
  },
}

/** With no required fields, only the announcement and the accept/decline buttons show. */
export const NoRequiredFields: Story = {
  beforeEach: () => {
    runInAction(() => {
      envStore.data.user_metadata_fields = []
    })
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /i agree/i })

    expect(canvas.queryByText(/full name/i)).not.toBeInTheDocument()
    expect(canvas.getByRole('button', { name: /i don't agree/i })).toBeInTheDocument()
  },
}
