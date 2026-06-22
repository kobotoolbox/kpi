import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
import { endpoints } from '#/api.endpoints'
import { MetaQuestionTypeName, QuestionTypeName } from '#/constants'
import type { PaginatedResponse, SubmissionResponse } from '#/dataInterface'
import assetFactory from '#/endpoints/asset.factory'
import assetDataFactory from '#/endpoints/assetData.factory'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { withMinHeightWrapper } from '#/storybookUtils'
import FormMapWrapper from './formMapWrapper'

const mockAssetUid = 'aTestMapAssetUid123'

// Asset with only start-geopoint (no regular geopoint question)
const assetWithOnlyStartGeopoint = assetFactory({
  uid: mockAssetUid,
  name: 'Test Form with Start-Geopoint Only',
  deployment__active: true,
  deployment__submission_count: 2,
  has_deployment: true,
  summary: {
    geo: true,
    labels: ['Your name'],
    columns: ['type', 'label'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 2,
    name_quality: { ok: 2, bad: 0, good: 0, total: 2, firsts: {} },
    default_translation: null,
  },
  content: {
    survey: [
      {
        $kuid: 'q1',
        type: QuestionTypeName.text,
        name: 'your_name',
        label: ['Your name'],
        required: false,
      },
      {
        $kuid: 'meta1',
        type: MetaQuestionTypeName['start-geopoint'],
        name: 'start-geopoint',
      },
    ],
    choices: [],
  },
})

// Asset with both start-geopoint AND regular geopoint
const assetWithBothGeopointTypes = assetFactory({
  uid: mockAssetUid,
  name: 'Test Form with Both Geopoint Types',
  deployment__active: true,
  deployment__submission_count: 2,
  has_deployment: true,
  summary: {
    geo: true,
    labels: ['Your name', 'Where are you?'],
    columns: ['type', 'label'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 3,
    name_quality: { ok: 3, bad: 0, good: 0, total: 3, firsts: {} },
    default_translation: null,
  },
  content: {
    survey: [
      {
        $kuid: 'q1',
        type: QuestionTypeName.text,
        name: 'your_name',
        label: ['Your name'],
        required: false,
      },
      {
        $kuid: 'q2',
        type: QuestionTypeName.geopoint,
        name: 'location',
        label: ['Where are you?'],
        required: false,
      },
      {
        $kuid: 'meta1',
        type: MetaQuestionTypeName['start-geopoint'],
        name: 'start-geopoint',
      },
    ],
    choices: [],
  },
})

// Submission data with populated start-geopoint
const submissionsWithStartGeopoint: SubmissionResponse[] = [
  assetDataFactory(1, {
    your_name: 'Alice',
    'start-geopoint': '42.3601 -71.0589 0 0', // Boston coordinates
    _geolocation: [42.3601, -71.0589],
  }),
  assetDataFactory(2, {
    your_name: 'Bob',
    'start-geopoint': '40.7128 -74.0060 0 0', // NYC coordinates
    _geolocation: [40.7128, -74.006],
  }),
]

// Submission data with both geopoint types populated
const submissionsWithBothGeopointTypes: SubmissionResponse[] = [
  assetDataFactory(1, {
    your_name: 'Alice',
    location: '43.3615 -72.0575 0 0', // slightly off the start
    'start-geopoint': '42.3601 -71.0589 0 0',
    _geolocation: [43.3615, -72.0575],
  }),
  assetDataFactory(2, {
    your_name: 'Bob',
    location: '41.7145 -75.0045 0 0', // slightly off the start
    'start-geopoint': '40.7128 -74.0060 0 0',
    _geolocation: [41.7145, -75.0045],
  }),
]

const meta: Meta<typeof FormMapWrapper> = {
  title: 'Features/FormMap',
  component: FormMapWrapper,
  parameters: {
    docs: {
      description: {
        component:
          '⚠️ **Docs view does NOT work reliably for these stories due to map initialization rule (there can be only one). Use single stories please.** Also note that many interactive elements are not mocked and will not work.',
      },
    },
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { uid: mockAssetUid },
      },
      routing: { path: ROUTES.FORM_DATA },
    }),
    a11y: { test: 'todo' },
  },
  decorators: [withRouter, queryClientDecorator, withMinHeightWrapper(400, { height: 400 })],
}

export default meta
type Story = StoryObj<typeof FormMapWrapper>

export const WithOnlyStartGeopoint: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(endpoints.ASSET_URL, ({ params }) => {
          if (params.uid !== mockAssetUid) return undefined
          return HttpResponse.json(assetWithOnlyStartGeopoint)
        }),
        http.get<{ uid: string; limit?: string; start?: string }>(endpoints.ASSET_DATA_URL, ({ params }) => {
          if (params.uid !== mockAssetUid) return undefined
          const response: PaginatedResponse<SubmissionResponse> = {
            count: submissionsWithStartGeopoint.length,
            next: null,
            previous: null,
            results: submissionsWithStartGeopoint,
          }
          return HttpResponse.json(response)
        }),
      ],
    },
  },
  args: {
    asset: assetWithOnlyStartGeopoint,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('Verify that the map container is rendered', async () => {
      await waitFor(
        async () => {
          const mapContainer = canvasElement.querySelector('#data-map')
          expect(mapContainer).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
    })

    await step('Verify that the map does NOT show "no geographical data" error', async () => {
      await waitFor(
        async () => {
          const errorText = canvas.queryByText(/This project does not include geographical data/i)
          expect(errorText).not.toBeInTheDocument()
        },
        { timeout: 5000 },
      )
    })

    await step('Verify that map settings button is enabled (indicates geo questions detected)', async () => {
      await waitFor(
        async () => {
          // The settings button should be enabled when hasGeoPoint is true
          const settingsButton = canvas.getByLabelText('Map display settings')
          expect(settingsButton).toBeEnabled()
        },
        { timeout: 5000 },
      )
    })
  },
}

export const WithBothGeopointTypes: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(endpoints.ASSET_URL, ({ params }) => {
          if (params.uid !== mockAssetUid) return undefined
          return HttpResponse.json(assetWithBothGeopointTypes)
        }),
        http.get<{ uid: string; limit?: string; start?: string }>(endpoints.ASSET_DATA_URL, ({ params }) => {
          if (params.uid !== mockAssetUid) return undefined
          const response: PaginatedResponse<SubmissionResponse> = {
            count: submissionsWithBothGeopointTypes.length,
            next: null,
            previous: null,
            results: submissionsWithBothGeopointTypes,
          }
          return HttpResponse.json(response)
        }),
      ],
    },
  },
  args: {
    asset: assetWithBothGeopointTypes,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const page = within(document.body)

    await step('Verify that the map loads successfully', async () => {
      await waitFor(
        async () => {
          const mapContainer = canvasElement.querySelector('#data-map')
          expect(mapContainer).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
    })

    await step('Verify map settings button is enabled', async () => {
      await waitFor(
        async () => {
          const settingsButton = canvas.getByLabelText('Map display settings')
          expect(settingsButton).toBeEnabled()
        },
        { timeout: 5000 },
      )
    })

    await step('Open Map display settings', async () => {
      const settingsButton = canvas.getByLabelText('Map display settings')
      settingsButton.click()

      await waitFor(
        async () => {
          const modal = page.getByRole('dialog', { name: /Map Settings/i })
          expect(modal).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
    })

    await step('Switch to geopoint question tab', async () => {
      const modal = page.getByRole('dialog', { name: /Map Settings/i })
      const geopointTab = within(modal).getByRole('tab', { name: /geopoint question/i })
      geopointTab.click()

      await waitFor(
        async () => {
          expect(geopointTab).toHaveAttribute('aria-selected', 'true')
        },
        { timeout: 5000 },
      )
    })

    await step('Verify both geopoint questions are available', async () => {
      const modal = page.getByRole('dialog', { name: /Map Settings/i })

      await waitFor(
        async () => {
          const whereAreYouOption = within(modal).getByText('Where are you?')
          const startGeopointOption = within(modal).getByText('start-geopoint')

          expect(whereAreYouOption).toBeInTheDocument()
          expect(startGeopointOption).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
    })
  },
}
