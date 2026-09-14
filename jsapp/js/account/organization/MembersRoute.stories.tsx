import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { toast } from 'react-hot-toast'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import organizationMock from '#/endpoints/organization.mocks'
import organizationMembersMock from '#/endpoints/organizationMembers.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { RequireOrg } from '#/router/RequireOrg'
import ToasterConfig from '#/toasterConfig'
import MembersRoute, { TOO_SHORT_WARNING } from './MembersRoute'

/**
 * Nothing on this route asks for in-app messages, but `helpBubbleStore` does on load, and unmocked it 404s against the
 * dev server and raises a red "Not Found" toast. Harmless anywhere else, misleading here: these stories mount a toaster
 * (see below) and one of them is *about* a toast.
 */
const helpBubbleMock = http.get('*/help/in_app_messages{/}?', () =>
  HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
)

/** Types into the search box and waits for the debounce to commit. */
async function search(canvas: ReturnType<typeof within>, phrase: string) {
  const input = await canvas.findByRole('textbox', { name: /search members/i })
  await userEvent.clear(input)
  await userEvent.type(input, phrase)
  // The input debounces before it tells the route, so nothing is requested on the first keystroke.
  await waitFor(() => expect(input).toHaveValue(phrase))
  return input
}

const meta: Meta<typeof MembersRoute> = {
  title: 'Features/MembersRoute',
  component: MembersRoute,
  tags: ['!autodocs'],
  parameters: {
    msw: { handlers: [organizationMock(), organizationMembersMock(), helpBubbleMock] },
    a11y: { disable: true },
  },
  // `react-hot-toast` keeps its queue in module state, so a toast raised by one story would otherwise still be on
  // screen in the next one - which matters here, because some of these stories assert that *no* toast shows up.
  beforeEach: () => {
    toast.remove()
  },
  decorators: [
    (Story) => (
      <RequireOrg>
        {/* The real app mounts this in `BasicLayout`; without it `notify()` output has nowhere to render. */}
        <ToasterConfig />
        <Story />
      </RequireOrg>
    ),
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof MembersRoute>

/**
 * No search yet: every member is listed and the search box sits next to the page title. The rows ("alice", "alvin",
 * "bob") come from `membersMockList` in the endpoint mock.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('alice')
    expect(canvas.getByText('bob')).toBeInTheDocument()
    expect(canvas.getByRole('textbox', { name: /search members/i })).toHaveAttribute('placeholder', 'Search members')
  },
}

/** A usable phrase reaches the endpoint and the table shows only the matches. */
export const SearchNarrowsList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('bob')

    await search(canvas, 'alice')

    await waitFor(() => expect(canvas.queryByText('bob')).not.toBeInTheDocument())
    expect(canvas.getByText('alice')).toBeInTheDocument()
    expect(canvas.queryByText('alvin')).not.toBeInTheDocument()
  },
}

export const SearchPhraseTooShort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('alice')

    await search(canvas, 'al')

    // Nothing was filtered out, and crucially neither an error nor a nag surfaced.
    expect(canvas.getByText('bob')).toBeInTheDocument()
    expect(canvas.getByText('alice')).toBeInTheDocument()
    expect(canvas.queryByText(TOO_SHORT_WARNING)).not.toBeInTheDocument()
  },
}

/** Pressing Enter means "search this now", so that is when a too-short phrase gets explained - as a toast. */
export const SearchPhraseTooShortWarnsOnEnter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('alice')

    const input = await search(canvas, 'al')
    await userEvent.type(input, '{enter}')

    await canvas.findByText(TOO_SHORT_WARNING)
    // The list is still all of them - the warning explains the lack of filtering, it isn't an error.
    expect(canvas.getByText('bob')).toBeInTheDocument()
  },
}

/** One more character makes for a real search. */
export const SearchPhraseGrowsIntoRealSearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('alice')

    await search(canvas, 'al')
    expect(canvas.getByText('bob')).toBeInTheDocument()

    await search(canvas, 'alv')

    await waitFor(() => expect(canvas.queryByText('bob')).not.toBeInTheDocument())
    expect(canvas.getByText('alvin')).toBeInTheDocument()
  },
}

/** An empty result set is a legitimate answer, so it gets a message rather than a bare table header. */
export const SearchWithoutMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('alice')

    await search(canvas, 'nobody')

    await canvas.findByText('No members match "nobody"')
    expect(canvas.queryByText('alice')).not.toBeInTheDocument()
  },
}

/**
 * A phrase the backend query parser refuses (an apostrophe opens an unterminated string literal) must not leave the
 * user staring at an empty page - and the search box has to stay put so they can fix the phrase.
 *
 * In the real app the failed query also raises an error toast carrying the backend's own wording, from the query
 * client's default `throwOnError`. Storybook's mock query client doesn't wire that up, hence only the inline alert here.
 */
export const SearchRejectedByBackend: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('alice')

    await search(canvas, "o'brien")

    await canvas.findByText(/could not search the members list/i)
    expect(canvas.getByRole('textbox', { name: /search members/i })).toBeInTheDocument()
  },
}

/** The error is not a dead end: fixing the phrase brings the table back. */
export const SearchRecoversFromRejectedPhrase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('alice')

    await search(canvas, "o'brien")
    await canvas.findByText(/could not search the members list/i)

    await search(canvas, 'bob')

    await canvas.findByText('bob')
    expect(canvas.queryByText(/could not search the members list/i)).not.toBeInTheDocument()
  },
}
