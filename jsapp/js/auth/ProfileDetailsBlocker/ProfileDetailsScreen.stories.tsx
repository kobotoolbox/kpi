import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { AccountFieldsConfig, AccountFieldsValues, UserMetadataField } from '#/account/account.constants'
import { getInitialAccountFieldsValues } from '#/account/account.utils'
import { meUpdateErrorsMock, meUpdateSuccessMock } from '#/endpoints/me.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import ProfileDetailsScreen from './ProfileDetailsScreen'

/**
 * The blocker's screen on its own, driven by props: the session reading that decides whether it appears at
 * all belongs to `ProfileDetailsBlocker`, and mounting that instead would mean these stories were about
 * `profileStore` rather than about the form.
 *
 * The frame around the card - the server theme, the logo, the footer - belongs to `AuthPageFrame`, and is
 * covered by its stories rather than repeated here.
 */

/** An instance asking for the organization block, with the fields an administrator marks required. */
const ORGANIZATION_FIELDS: UserMetadataField[] = [
  { name: 'name', required: true, label: 'Full name' },
  { name: 'country', required: true, label: 'Country' },
  { name: 'organization_type', required: true, label: 'Organization type' },
  { name: 'organization', required: true, label: 'Organization name' },
  { name: 'organization_website', required: false, label: 'Organization website' },
]

/** Everything `USER_METADATA_FIELDS` can hold, most of it optional - the "fill the rest in while you are here" case. */
const EVERY_FIELD: UserMetadataField[] = [
  { name: 'name', required: true, label: 'Full name' },
  { name: 'gender', required: false, label: 'Gender' },
  { name: 'country', required: false, label: 'Country' },
  { name: 'city', required: false, label: 'City' },
  { name: 'sector', required: false, label: 'Sector' },
  { name: 'organization_type', required: false, label: 'Organization type' },
  { name: 'organization', required: false, label: 'Organization name' },
  { name: 'organization_website', required: false, label: 'Organization website' },
  { name: 'bio', required: false, label: 'Bio' },
  { name: 'newsletter_subscription', required: false, label: 'I want to receive occasional updates' },
]

/** Dropdown choices come from `/environment` too, and a couple of each is enough to show the inputs working. */
const configFor = (userMetadataFields: UserMetadataField[]): AccountFieldsConfig => ({
  userMetadataFields,
  countryChoices: [
    { value: 'DEU', label: 'Germany' },
    { value: 'GBR', label: 'United Kingdom' },
  ],
  sectorChoices: [
    { value: 'Humanitarian - Sanitation, Water & Hygiene', label: 'Humanitarian - Sanitation, Water & Hygiene' },
    { value: 'Public Administration', label: 'Public Administration' },
  ],
})

const values = (overrides: Partial<AccountFieldsValues> = {}): AccountFieldsValues => ({
  ...getInitialAccountFieldsValues(),
  ...overrides,
})

const meta: Meta<typeof ProfileDetailsScreen> = {
  title: 'Features/ProfileDetailsScreen',
  component: ProfileDetailsScreen,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [meUpdateSuccessMock()] },
  },
  args: {
    // Explicit, not left to `argTypesRegex`: the point of several stories is that it was or was not called.
    onSaved: fn(),
    initialValues: values(),
    fieldsConfig: configFor(ORGANIZATION_FIELDS),
    isMmoMember: false,
  },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof ProfileDetailsScreen>

type Canvas = ReturnType<typeof within>

/** Finds an input by its label, which carries a required marker we don't want to spell out every time. */
const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

/** Resolves once the form is on screen. */
const waitForForm = (canvas: Canvas) => canvas.findByRole('button', { name: 'Continue' })

const submit = async (canvas: Canvas) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Continue' }))
}

/** A profile with nothing in it, which is the state most people reach this screen in. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitForForm(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Complete your profile details' })
    expect(field(canvas, 'Full name')).toHaveValue('')
    // Both ways out are offered - being stuck here with no exit is this screen's worst outcome.
    expect(canvas.getByRole('button', { name: 'Logout' })).toBeEnabled()
  },
}

/**
 * Only `name` is required, but every configured field is on offer: somebody sent here for one thing can
 * fill in the rest while they are at it.
 */
export const EveryConfiguredField: Story = {
  args: { fieldsConfig: configFor(EVERY_FIELD) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitForForm(canvas)

    for (const label of ['Full name', 'Gender', 'Country', 'City', 'Sector', 'Organization type', 'Bio']) {
      expect(field(canvas, label)).toBeInTheDocument()
    }
    expect(canvas.getByRole('checkbox', { name: /occasional updates/ })).toBeInTheDocument()
  },
}

/**
 * Members of a multi-member organization are not allowed to write the organization fields, so those are
 * neither shown nor held against them - even though this instance marks them required.
 */
export const MmoMember: Story = {
  args: {
    initialValues: values({ name: 'Caroline Herschel', country: 'DEU' }),
    isMmoMember: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitForForm(canvas)

    expect(field(canvas, 'Full name')).toBeInTheDocument()
    expect(canvas.queryByLabelText(/^Organization/)).not.toBeInTheDocument()

    // The blank required organization fields must not block the save, or this would be a dead end.
    await submit(canvas)
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled())
  },
}

/**
 * `organization_type: 'none'` means "not with an organization", and the server drops the required-ness of
 * the two fields describing one. The editor hides them at the same time.
 */
export const NoOrganization: Story = {
  args: {
    initialValues: values({ name: 'Caroline Herschel', country: 'DEU', organization_type: 'none' }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitForForm(canvas)

    expect(canvas.queryByLabelText(/^Organization name/)).not.toBeInTheDocument()

    await submit(canvas)
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled())
  },
}

/**
 * Submitting with required fields blank is caught here rather than sent: a PATCH that omits a blank
 * required field is *accepted*, so the request would look like success and put this screen straight back
 * up.
 */
export const ClientValidation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitForForm(canvas)

    await submit(canvas)

    // Every required field this instance asks for: `name`, `country`, `organization_type`, `organization`.
    // The blank type does not excuse `organization` - only `'none'` does, which is the server's rule too.
    expect(await canvas.findAllByText('Required field')).toHaveLength(4)
    expect(args.onSaved).not.toHaveBeenCalled()

    // Typing is an answer to the message, so it stops applying.
    await userEvent.type(field(canvas, 'Full name'), 'Caroline Herschel')
    await waitFor(() => expect(canvas.getAllByText('Required field')).toHaveLength(3))
  },
}

/**
 * Both ways a rejection gets shown: a message naming a field goes under that field, one belonging to no
 * field goes in the banner above the form. What was typed survives either, so nobody has to fill the form
 * in twice.
 *
 * They arrive together here so one story covers both - the endpoint usually sends one or the other.
 */
export const ErrorsFromServer: Story = {
  args: { initialValues: values({ name: 'Caroline Herschel', country: 'DEU', organization_type: 'non-profit' }) },
  parameters: {
    msw: {
      handlers: [
        meUpdateErrorsMock({
          fieldErrors: { name: 'Enter a name that is not the example from the documentation.' },
          detail: 'These details could not be saved.',
        }),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitForForm(canvas)

    await userEvent.type(field(canvas, 'Organization name'), 'Royal Astronomical Society')
    await submit(canvas)

    await canvas.findByText('Enter a name that is not the example from the documentation.')
    await canvas.findByText('These details could not be saved.')

    expect(field(canvas, 'Organization name')).toHaveValue('Royal Astronomical Society')
    expect(args.onSaved).not.toHaveBeenCalled()
  },
}
