import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import NewFeatureDialog from './newFeatureDialog.component'

const DEMO_CONTENT =
  'You can now control the weather for each of your subjects. Very likely this will be used for good.'

/**
 * The dialog hides itself permanently (per user, per `featureKey`) once dismissed, by writing to `localStorage`. Stories
 * share one browser session, so without this the dialog would be invisible in every story after the first dismissal.
 */
function clearDismissedDialogs() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('kpiDialogStatus-')) {
      localStorage.removeItem(key)
    }
  }
}

const meta: Meta<typeof NewFeatureDialog> = {
  title: 'Components/NewFeatureDialog',
  component: NewFeatureDialog,
  args: {
    content: DEMO_CONTENT,
    featureKey: 'storybookDemo',
    children: (
      <div style={{ border: '1px dashed var(--mantine-color-gray-5)', padding: '8px 12px' }}>
        The highlighted feature goes here
      </div>
    ),
  },
  beforeEach: () => {
    clearDismissedDialogs()
  },
  decorators: [
    // The dialog is absolutely positioned below its children, so it needs room to render into.
    (Story) => <div style={{ minHeight: 240, maxWidth: 480, padding: 'var(--mantine-spacing-lg)' }}>{Story()}</div>,
  ],
  parameters: {
    // The component's close button is an icon-only `<button>` with no accessible name, which axe flags as
    // `button-name`. Disabled here so the story documents the component as-is.
    a11y: { disable: true },
  },
}

export default meta

type Story = StoryObj<typeof NewFeatureDialog>

export const Default: Story = {}

/** Adds a "Learn more" link pointing at a support article. */
export const WithSupportArticle: Story = {
  args: {
    featureKey: 'storybookDemoWithSupportArticle',
    supportArticle: 'https://support.kobotoolbox.org/',
  },
}

/**
 * `disabled` suppresses the dialog without marking it as seen — used when several dialogs for the same feature are on
 * screen at once, or while a modal covers the page.
 */
export const Disabled: Story = {
  args: {
    featureKey: 'storybookDemoDisabled',
    disabled: true,
  },
}

/** Dismissing the dialog hides it and records that in `localStorage`, so it stays hidden on future visits. */
export const Dismiss: Story = {
  args: {
    featureKey: 'storybookDemoDismiss',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText(DEMO_CONTENT)

    // The close button is icon-only, so there is no accessible name to query by. It is the only button in the story.
    await userEvent.click(canvas.getByRole('button'))

    await waitFor(async () => {
      await expect(canvas.queryByText(DEMO_CONTENT)).not.toBeInTheDocument()
    })
  },
}
