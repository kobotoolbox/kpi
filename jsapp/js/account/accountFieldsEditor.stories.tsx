import type { Decorator, Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, within } from 'storybook/test'
import { type Canvas, field } from '#/auth/authStoryHelpers'
import { environmentResponse } from '#/endpoints/environment.mocks'
import type { UserMetadataField } from '#/envStore'
import { seedEnvStore } from '#/envStore.mocks'
import type { AccountFieldsValues } from './account.constants'
import { getInitialAccountFieldsValues, isUserFieldName } from './account.utils'
import AccountFieldsEditor from './accountFieldsEditor.component'

/** The default `/environment` fields plus `gender`, which it leaves out. */
const EVERY_FIELD: UserMetadataField[] = [
  ...environmentResponse.user_metadata_fields.filter((item): item is UserMetadataField => isUserFieldName(item.name)),
  { name: 'gender', required: false, label: 'Gender' },
]

const values = (overrides: Partial<AccountFieldsValues> = {}): AccountFieldsValues => ({
  ...getInitialAccountFieldsValues(),
  ...overrides,
})

/** Wide enough for fields to sit in pairs, see `$field-min-width` in the stylesheet. */
const twoColumnDecorator: Decorator = (Story) => <div style={{ width: 640 }}>{Story()}</div>

const meta: Meta<typeof AccountFieldsEditor> = {
  title: 'Components/AccountFieldsEditor',
  component: AccountFieldsEditor,
  args: {
    values: values(),
    onFieldChange: fn(),
  },
  beforeEach: seedEnvStore({ user_metadata_fields: EVERY_FIELD }),
  decorators: [twoColumnDecorator],
}

export default meta
type Story = StoryObj<typeof AccountFieldsEditor>

const rectOf = (canvas: Canvas, label: string) => field(canvas, label).getBoundingClientRect()

/** Every field an instance can configure, so a field the editor stops rendering fails here. */
export const EveryField: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    for (const label of [
      'Full name',
      'Gender',
      'Country',
      'City',
      'Sector',
      'Organization type',
      'Organization name',
      'Organization website',
      'Bio',
    ]) {
      await expect(field(canvas, label)).toBeInTheDocument()
    }
    for (const placeholder of ['Twitter', 'LinkedIn', 'Instagram']) {
      await expect(canvas.getByPlaceholderText(placeholder)).toBeInTheDocument()
    }
    await expect(canvas.getByText('Social')).toBeInTheDocument()
    await expect(canvas.getByRole('checkbox', { name: /occasional updates/ })).toBeInTheDocument()
  },
}

/** Country and city both shown: they start a new row together instead of splitting across two. */
export const PairStartsNewRow: Story = {
  args: { displayedFields: ['name', 'country', 'city'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(rectOf(canvas, 'Country').top).toBeGreaterThan(rectOf(canvas, 'Full name').top)
    await expect(rectOf(canvas, 'City').top).toBe(rectOf(canvas, 'Country').top)
  },
}

/** Only half of the pair shown: it shares the row with the field before it. */
export const HalfPairSharesRow: Story = {
  args: { displayedFields: ['name', 'country'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(rectOf(canvas, 'Country').top).toBe(rectOf(canvas, 'Full name').top)
  },
}

/** Organization type is the toggle for the organization fields, so it comes along with either of them. */
export const OrganizationTypeComesAlong: Story = {
  args: { displayedFields: ['organization'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(field(canvas, 'Organization type')).toBeInTheDocument()
    await expect(field(canvas, 'Organization name')).toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Organization website/)).not.toBeInTheDocument()
  },
}

/**
 * No organization: its fields go away, but the spacer before them stays, so organization type keeps its
 * half-width slot instead of stretching across the row.
 */
export const NoOrganization: Story = {
  args: {
    displayedFields: ['name', 'country', 'organization_type', 'organization', 'organization_website'],
    values: values({ organization_type: 'none' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByLabelText(/^Organization name/)).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Organization website/)).not.toBeInTheDocument()
    await expect(rectOf(canvas, 'Organization type').width).toBeCloseTo(rectOf(canvas, 'Full name').width, 0)
  },
}

/** With an organization, its two fields start a row of their own below organization type. */
export const WithOrganization: Story = {
  args: {
    displayedFields: ['name', 'country', 'organization_type', 'organization', 'organization_website'],
    values: values({ organization_type: 'non-profit' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const orgType = rectOf(canvas, 'Organization type')
    const orgName = rectOf(canvas, 'Organization name')
    await expect(orgName.top).toBeGreaterThan(orgType.top)
    await expect(rectOf(canvas, 'Organization website').top).toBe(orgName.top)
  },
}
