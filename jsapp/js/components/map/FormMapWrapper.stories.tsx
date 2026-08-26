import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
import { endpoints } from '#/api.endpoints'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import { MetaQuestionTypeName, QuestionTypeName } from '#/constants'
import type { AssetResponse, PaginatedResponse, SubmissionResponse } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { withMinHeightWrapper } from '#/storybookUtils'
import FormMapWrapper from './formMapWrapper'
import { mapTileHandlers } from './mapTiles.mocks'

const mockAssetUid = 'aTestMapAssetUid123'

// Cast Orval-generated Assets to legacy AssetResponse type
// The types are structurally compatible at runtime (see DataTableWrapper.stories.tsx for details)

// Asset with only start-geopoint (no regular geopoint question)
const assetWithOnlyStartGeopoint = getApiV2AssetsRetrieveResponseMock({
  uid: mockAssetUid,
  name: 'Test Form with Start-Geopoint Only',
  deployment__active: true,
  deployment__submission_count: 2,
  has_deployment: true,
  map_styles: {},
  summary: {
    geo: true,
    labels: ['Your name'],
    columns: ['type', 'label'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 2,
    name_quality: { ok: 2, bad: 0, good: 0, total: 2, firsts: {} },
    default_translation: undefined,
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
}) as unknown as AssetResponse

// Asset with both start-geopoint AND regular geopoint
const assetWithBothGeopointTypes = getApiV2AssetsRetrieveResponseMock({
  uid: mockAssetUid,
  name: 'Test Form with Both Geopoint Types',
  deployment__active: true,
  deployment__submission_count: 2,
  has_deployment: true,
  map_styles: {},
  summary: {
    geo: true,
    labels: ['Your name', 'Where are you?'],
    columns: ['type', 'label'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 3,
    name_quality: { ok: 3, bad: 0, good: 0, total: 3, firsts: {} },
    default_translation: undefined,
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
}) as unknown as AssetResponse

// Asset used to check how points collected on both sides of the 180th meridian are displayed
const assetWithPacificGeopoints = getApiV2AssetsRetrieveResponseMock({
  uid: mockAssetUid,
  name: 'Test Form with Points Across the 180th Meridian',
  deployment__active: true,
  deployment__submission_count: 4,
  has_deployment: true,
  map_styles: {},
  summary: {
    geo: true,
    labels: ['Your name', 'Where are you?'],
    columns: ['type', 'label'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 2,
    name_quality: { ok: 2, bad: 0, good: 0, total: 2, firsts: {} },
    default_translation: undefined,
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
    ],
    choices: [],
  },
}) as unknown as AssetResponse

// Submission data with populated start-geopoint
const submissionsWithStartGeopoint: SubmissionResponse[] = [
  assetDataFactory(1, {
    your_name: 'Alice',
    'start-geopoint': '30.0087 31.2484 0 0', // The National Museum of Egyptian Civilization
    _geolocation: [30.0087, 31.2484],
  }),
  assetDataFactory(2, {
    your_name: 'Bob',
    'start-geopoint': '29.9733 31.1315 0 0', // Pyramid of Menkaure
    _geolocation: [29.9733, 31.1315],
  }),
]

// Submission data with both geopoint types populated
const submissionsWithBothGeopointTypes: SubmissionResponse[] = [
  assetDataFactory(1, {
    your_name: 'Alice',
    location: '-34.3536 18.4939 0 0', // slightly off the start
    'start-geopoint': '-34.3566 18.4969 0 0', // New Cape Point Lighthouse
    _geolocation: [-34.3536, 18.4939],
  }),
  assetDataFactory(2, {
    your_name: 'Bob',
    location: '-34.3757 18.8248 0 0', // slightly off the start
    'start-geopoint': '-34.3787 18.8278 0 0', // Moonlight Beach
    _geolocation: [-34.3757, 18.8248],
  }),
]

// Two submissions in Vanuatu (east of the 180th meridian) and two in Samoa (west of it)
const submissionsAcrossAntimeridian: SubmissionResponse[] = [
  assetDataFactory(1, {
    your_name: 'Alice',
    location: '-17.7333 168.3273 0 0', // Port Vila
    _geolocation: [-17.7333, 168.3273],
  }),
  assetDataFactory(2, {
    your_name: 'Bob',
    location: '-17.5667 168.1667 0 0', // Mele
    _geolocation: [-17.5667, 168.1667],
  }),
  assetDataFactory(3, {
    your_name: 'Carla',
    location: '-13.8333 -171.7667 0 0', // Apia
    _geolocation: [-13.8333, -171.7667],
  }),
  assetDataFactory(4, {
    your_name: 'Dan',
    location: '-14.0333 -171.4833 0 0', // Lotofaga
    _geolocation: [-14.0333, -171.4833],
  }),
]

/** Everything a map story needs mocked: the asset, its submissions and the tiles the map is drawn on. */
function mapHandlers(asset: AssetResponse, submissions: SubmissionResponse[]) {
  return [
    http.get(endpoints.ASSET_URL, ({ params }) => {
      if (params.uid !== mockAssetUid) return undefined
      return HttpResponse.json(asset)
    }),
    http.get<{ uid: string; limit?: string; start?: string }>(endpoints.ASSET_DATA_URL, ({ params }) => {
      if (params.uid !== mockAssetUid) return undefined
      const response: PaginatedResponse<SubmissionResponse> = {
        count: submissions.length,
        next: null,
        previous: null,
        results: submissions,
      }
      return HttpResponse.json(response)
    }),
    ...mapTileHandlers,
  ]
}

const meta: Meta<typeof FormMapWrapper> = {
  title: 'Features/FormMap',
  component: FormMapWrapper,
  // Docs view does NOT work reliably for these stories due to map initialization rule (there can be only one)
  tags: ['!autodocs'],
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { uid: mockAssetUid },
      },
      routing: { path: ROUTES.FORM_DATA },
    }),
    a11y: { disable: true },
    chromatic: {
      delay: 1000,
    },
  },
  decorators: [
    withRouter,
    queryClientDecorator,
    withMinHeightWrapper(400, { height: 400 }),
    // Tiles are mocked (see `mapTiles.mocks.ts`), so this only fills the map while they are on their way in
    (Story) => (
      <>
        <style>
          {`
            #data-map {
              background: #94c7d1 !important;
            }
          `}
        </style>
        <Story />
      </>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof FormMapWrapper>

export const WithOnlyStartGeopoint: Story = {
  parameters: {
    msw: { handlers: mapHandlers(assetWithOnlyStartGeopoint, submissionsWithStartGeopoint) },
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
    msw: { handlers: mapHandlers(assetWithBothGeopointTypes, submissionsWithBothGeopointTypes) },
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

export const WithPointsAcrossAntimeridian: Story = {
  parameters: {
    msw: { handlers: mapHandlers(assetWithPacificGeopoints, submissionsAcrossAntimeridian) },
  },
  args: {
    asset: assetWithPacificGeopoints,
  },
  // Chromatic is what checks this story: the snapshot tells whether the map fitted the 20° span across the meridian, or
  // read it as the 340° span the other way around and zoomed out to the whole world. Waiting for the markers only keeps
  // the snapshot from being taken before the map has finished drawing itself.
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('.leaflet-marker-icon').length).toBeGreaterThan(0), {
      timeout: 5000,
    })
  },
}

export const WithPointsRepeatedInEveryWorldCopy: Story = {
  parameters: {
    msw: { handlers: mapHandlers(assetWithPacificGeopoints, submissionsAcrossAntimeridian) },
  },
  args: {
    asset: assetWithPacificGeopoints,
  },
  // Zooming all the way out is what this story is about, so that part is not a check and has to stay — it is what puts
  // several copies of the world on screen for Chromatic to snapshot. What the points then do is the snapshot's business:
  // a cluster in every copy, one every 256 pixels. `getWorldCopyOffsets()` has the unit tests for the arithmetic.
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('.leaflet-marker-icon').length).toBeGreaterThan(0), {
      timeout: 5000,
    })

    await waitFor(
      () => {
        // One click per attempt, until the control tells us there is nowhere left to zoom out to
        const zoomOutButton = canvasElement.querySelector<HTMLAnchorElement>('.leaflet-control-zoom-out')
        zoomOutButton?.click()
        expect(zoomOutButton).toHaveClass('leaflet-disabled')
      },
      { timeout: 10000 },
    )
  },
}
