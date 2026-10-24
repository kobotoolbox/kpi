import type { Decorator, Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse, delay } from 'msw'
import { useEffect, useRef, useState } from 'react'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
import { endpoints } from '#/api.endpoints'
import type { PaginatedDataResponseListCount } from '#/api/models/paginatedDataResponseListCount'
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

/** What the paged data handler below saw: the `start` of every page requested, and the most requested at once. */
interface DataRequestLog {
  starts: number[]
  inFlight: number
  maxInFlight: number
}

/**
 * Like `mapHandlers()`, but for a project with `total` submissions, served a page at a time the way the data API does:
 * honouring `start` and `limit`, with a `next` link until the submissions run out, and reporting `count` (which can be
 * capped). Each page holds a single point, as the map only cares about the paging here. Every request is logged, and
 * held back a moment so that the ones made at the same time overlap.
 */
function pagedMapHandlers(asset: AssetResponse, total: number, count: PaginatedDataResponseListCount) {
  const log: DataRequestLog = { starts: [], inFlight: 0, maxInFlight: 0 }
  const resetLog = () => {
    log.starts = []
    log.inFlight = 0
    log.maxInFlight = 0
  }

  const handlers = [
    http.get(endpoints.ASSET_URL, ({ params }) => {
      if (params.uid !== mockAssetUid) return undefined
      return HttpResponse.json(asset)
    }),
    http.get<{ uid: string }>(endpoints.ASSET_DATA_URL, async ({ params, request }) => {
      if (params.uid !== mockAssetUid) return undefined
      const url = new URL(request.url)
      const start = Number(url.searchParams.get('start') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 1000)

      log.starts.push(start)
      log.inFlight++
      log.maxInFlight = Math.max(log.maxInFlight, log.inFlight)
      await delay(50)
      log.inFlight--

      const nextUrl = new URL(url)
      nextUrl.searchParams.set('start', String(start + limit))
      const response = {
        count,
        next: start + limit < total ? nextUrl.toString() : null,
        previous: null,
        results:
          start < total
            ? [
                assetDataFactory(start + 1, {
                  your_name: `Page ${start / limit + 1}`,
                  location: `-17.7333 ${168.3273 + start / 100000} 0 0`, // Port Vila, nudged east for each page
                  _geolocation: [-17.7333, 168.3273 + start / 100000],
                }),
              ]
            : [],
      }
      return HttpResponse.json(response)
    }),
    ...mapTileHandlers,
  ]

  return { handlers, log, resetLog }
}

/**
 * Holds the story back until the browser has given the container a layout box.
 *
 * Leaflet measures its container once, when the map is created, and reuses that size until something calls
 * `invalidateSize()`. Storybook can start rendering a story while `#storybook-root` is still hidden — during the
 * "preparing" state, or while switching stories on a busy machine — and a map created in a hidden container
 * measures 0×0. It then fits its bounds against nothing, settles on max zoom with all the points off screen, and
 * stays like that once the container gets its real size: no markers, one lonely tile at zoom 17. Mounting a beat
 * later costs nothing here and takes that whole failure mode off the table.
 */
const withLaidOutContainer: Decorator = (Story) => {
  const wrapper = useRef<HTMLDivElement>(null)
  const [laidOut, setLaidOut] = useState(false)

  useEffect(() => {
    const element = wrapper.current
    if (!element) return

    // Width, because it comes from the parent: a hidden element measures 0 whatever it holds, while an empty but
    // visible one still spans the story canvas. Height would be 0 here until the story itself fills it.
    const check = () => setLaidOut(element.getBoundingClientRect().width > 0)
    check()

    // Fires when the box appears, which is exactly the moment the map may be created safely
    const observer = new ResizeObserver(check)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapper} style={{ height: '100%' }}>
      {laidOut && <Story />}
    </div>
  )
}

/**
 * Ceiling shared by the waits below. `waitFor` carries on the moment its condition holds, so a high ceiling costs
 * nothing on a quick machine and only buys patience on a cold CI worker. Kept under the runner's 30s per-story limit,
 * so a real regression fails on the assertion rather than on the clock.
 */
const WAIT = { timeout: 10000 }

/** The markers the map has drawn, clusters included. Scoped to the map, so it also covers the container being there. */
const plottedMarkers = (canvasElement: HTMLElement) => canvasElement.querySelectorAll('#data-map .leaflet-marker-icon')

/**
 * What state the map is in, to go with a wait that gave up. On CI the failure is otherwise only "expected 0 to be
 * greater than 0", which does not say whether the data never arrived, the container has no size, or Leaflet drew nothing.
 */
function describeMap(canvasElement: HTMLElement) {
  const container = canvasElement.querySelector('#data-map')
  const tiles = Array.from(canvasElement.querySelectorAll('#data-map .leaflet-tile'))
  const zooms = new Set(tiles.map((tile) => tile.getAttribute('src')?.match(/\/(\d+)\/\d+\/\d+/)?.[1]))
  const overlay = Array.from(canvasElement.querySelectorAll('.map-no-geopoint'), (line) => line.textContent).join(' / ')
  const size = container ? `${container.clientWidth}×${container.clientHeight}` : 'no container'
  return `map ${size}, ${tiles.length} tiles at zoom ${[...zooms].join()}, overlay "${overlay}"`
}

/**
 * Waits for the map to plot its submissions, in the two steps it goes through: the data lands (the map stops saying it
 * is fetching points), then Leaflet draws it. Both are the map's own signals, so no story has to guess at how long
 * either takes.
 */
async function waitForPlottedPoints(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await waitFor(
    () => expect(canvas.queryByText(/Fetching points/i), describeMap(canvasElement)).not.toBeInTheDocument(),
    WAIT,
  )
  await waitFor(() => expect(plottedMarkers(canvasElement).length, describeMap(canvasElement)).toBeGreaterThan(0), WAIT)
}

/**
 * Waits for one zoom step to land. Leaflet drops a zoom it is asked for while still animating the previous one, so
 * clicks have to be spaced out by this. The animation starts on the frame after the click, hence the two frames before
 * trusting that the class it puts on the pane is gone.
 */
async function waitForZoomToLand(canvasElement: HTMLElement) {
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  const mapPane = canvasElement.querySelector('.leaflet-map-pane')
  await waitFor(() => expect(mapPane).not.toHaveClass('leaflet-zoom-anim'), WAIT)
}

/**
 * Waits for the map to finish requesting pages, and checks it stops at the last one holding submissions. Gives it a
 * moment after the loading message goes, so a page requested past the end would be caught rather than missed.
 */
async function waitForRequestedPages(canvasElement: HTMLElement, log: DataRequestLog, expectedStarts: number[]) {
  await waitFor(() => expect(log.starts).toEqual(expectedStarts), WAIT)
  await waitFor(() => expect(within(canvasElement).queryByText(/Fetching points/i)).not.toBeInTheDocument(), WAIT)
  // A page past the end would be requested right after the last one, and is logged as soon as it is requested
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(log.starts).toEqual(expectedStarts)
}

/** 2,500 submissions with a 20,000 limit saved, so the map could ask for 20 pages but only 3 hold anything */
const assetWithManySubmissions = {
  ...assetWithPacificGeopoints,
  deployment__submission_count: 2500,
  map_styles: { querylimit: '20000' },
} as AssetResponse

const cappedCountData = pagedMapHandlers(assetWithManySubmissions, 2500, 'many')
const exactCountData = pagedMapHandlers(assetWithManySubmissions, 2500, 2500)

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
    withLaidOutContainer,
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

    await step('Wait for the map to plot the start-geopoints', () => waitForPlottedPoints(canvasElement))

    // Checked once the points are drawn, so a missing error means there is none rather than that we looked too early
    await step('Verify that the map does NOT show "no geographical data" error', async () => {
      expect(canvas.queryByText(/This project does not include geographical data/i)).not.toBeInTheDocument()
    })

    await step('Verify that map settings button is enabled (indicates geo questions detected)', async () => {
      // The settings button should be enabled when hasGeoPoint is true
      expect(canvas.getByLabelText('Map display settings')).toBeEnabled()
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

    await step('Verify that the map loads successfully', () => waitForPlottedPoints(canvasElement))

    await step('Verify map settings button is enabled', async () => {
      expect(canvas.getByLabelText('Map display settings')).toBeEnabled()
    })

    await step('Open Map display settings', async () => {
      const settingsButton = canvas.getByLabelText('Map display settings')
      settingsButton.click()

      await waitFor(async () => {
        const modal = page.getByRole('dialog', { name: /Map Settings/i })
        expect(modal).toBeInTheDocument()
      }, WAIT)
    })

    await step('Switch to geopoint question tab', async () => {
      const modal = page.getByRole('dialog', { name: /Map Settings/i })
      const geopointTab = within(modal).getByRole('tab', { name: /geopoint question/i })
      geopointTab.click()

      await waitFor(async () => {
        expect(geopointTab).toHaveAttribute('aria-selected', 'true')
      }, WAIT)
    })

    await step('Verify both geopoint questions are available', async () => {
      const modal = page.getByRole('dialog', { name: /Map Settings/i })

      await waitFor(async () => {
        const whereAreYouOption = within(modal).getByText('Where are you?')
        const startGeopointOption = within(modal).getByText('start-geopoint')

        expect(whereAreYouOption).toBeInTheDocument()
        expect(startGeopointOption).toBeInTheDocument()
      }, WAIT)
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
    await waitForPlottedPoints(canvasElement)
  },
}

export const WithPointsRepeatedInEveryWorldCopy: Story = {
  parameters: {
    msw: { handlers: mapHandlers(assetWithPacificGeopoints, submissionsAcrossAntimeridian) },
  },
  args: {
    asset: assetWithPacificGeopoints,
  },
  // Zooming all the way out is the setup rather than the check: it is what puts several copies of the world on screen
  // for Chromatic to snapshot. The play function only counts the clusters; where exactly they land is the snapshot's
  // business, and `getWorldCopyOffsets()` has the unit tests for the arithmetic.
  play: async ({ canvasElement, step }) => {
    await step('Wait for the map to plot the points', () => waitForPlottedPoints(canvasElement))

    await step('Zoom out as far as the map goes', async () => {
      const zoomOutButton = canvasElement.querySelector<HTMLAnchorElement>('.leaflet-control-zoom-out')
      expect(zoomOutButton).toBeInTheDocument()

      // `maxZoom` is 17, so the minimum is never more than 17 clicks away; the spare attempts cover clicks the map
      // dropped while animating the one before.
      for (let attempt = 0; attempt < 30 && !zoomOutButton?.classList.contains('leaflet-disabled'); attempt++) {
        zoomOutButton?.click()
        await waitForZoomToLand(canvasElement)
      }
      expect(zoomOutButton).toHaveClass('leaflet-disabled')
    })

    await step('Verify the points show up in every copy of the world on screen', async () => {
      // At this zoom the world fits on screen several times over, and every copy gets its own cluster of the same four
      // points — so more than the single cluster the points alone would make.
      await waitFor(() => expect(plottedMarkers(canvasElement).length).toBeGreaterThan(1), WAIT)
    })
  },
}

export const WithCappedCountRequestsPagesOneAtATime: Story = {
  parameters: {
    msw: { handlers: cappedCountData.handlers },
  },
  args: {
    asset: assetWithManySubmissions,
  },
  beforeEach: () => {
    cappedCountData.resetLog()
  },
  // A 'many' count doesn't say where the submissions end, so the map has to follow the `next` links instead of asking for
  // all 20 pages its limit allows
  play: async ({ canvasElement, step }) => {
    await step('Wait for the map to request every page holding submissions, and no more', () =>
      waitForRequestedPages(canvasElement, cappedCountData.log, [0, 1000, 2000]),
    )

    await step('Verify the pages were requested one at a time', async () => {
      expect(cappedCountData.log.maxInFlight).toBe(1)
    })

    await step('Verify the points from every page are plotted', async () => {
      await waitFor(() => expect(plottedMarkers(canvasElement).length).toBeGreaterThan(0), WAIT)
    })
  },
}

export const WithExactCountRequestsPagesAtOnce: Story = {
  parameters: {
    msw: { handlers: exactCountData.handlers },
  },
  args: {
    asset: assetWithManySubmissions,
  },
  beforeEach: () => {
    exactCountData.resetLog()
  },
  // An exact count already tells the map which pages hold submissions, so after the first one it asks for the rest at once
  play: async ({ canvasElement, step }) => {
    await step('Wait for the map to request every page holding submissions, and no more', () =>
      waitForRequestedPages(canvasElement, exactCountData.log, [0, 1000, 2000]),
    )

    await step('Verify the pages after the first were requested together', async () => {
      expect(exactCountData.log.maxInFlight).toBe(2)
    })

    await step('Verify the points from every page are plotted', async () => {
      await waitFor(() => expect(plottedMarkers(canvasElement).length).toBeGreaterThan(0), WAIT)
    })
  },
}
