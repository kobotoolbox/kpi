import {
  getApiV2AssetsListMockHandler,
  getApiV2AssetsRetrieveResponseMock,
} from '#/api/react-query/manage-projects-and-library-content'
import { AssetTypeName, QuestionTypeName } from '#/constants'
import type { AssetResponse, PaginatedResponse } from '#/dataInterface'
import { mockTemplates } from './assets.templates'

/**
 * Mock API for assets list using Orval-generated handler.
 * Use it in Storybook tests in `parameters.msw.handlers.assets`.
 *
 * Supports query parameter 'q' for filtering by asset type:
 * - 'asset_type:template' returns mockTemplates
 * - Other queries return default mock assets
 *
 * If override contains `count` but omits results, default response results will be sliced accordingly.
 * Note that default response contains only 2 results.
 */
const assetsMock = (override?: Partial<PaginatedResponse<AssetResponse>>) =>
  getApiV2AssetsListMockHandler(async (info) => {
    const searchParams = new URL(info.request.url).searchParams
    const limit = searchParams.get('limit') !== null ? Number(searchParams.get('limit')) : undefined
    const query = searchParams.get('q')

    // Handle template queries
    if (query === 'asset_type:template') {
      return {
        count: mockTemplates.length,
        next: null,
        previous: null,
        results: mockTemplates.slice(0, limit),
      }
    }

    // Default behavior for other queries
    return {
      ...defaultMockResponse,
      ...override,
      results: (override?.results ?? defaultMockResponse.results).slice(0, limit ?? override?.count ?? undefined),
    }
  })

export default assetsMock

// Default mock assets using Orval-generated mocks
// Note: Cast to AssetResponse for backward compatibility (see DataTableWrapper.stories.tsx)
const defaultMockResponse: PaginatedResponse<AssetResponse> = {
  count: 2,
  next: null,
  previous: null,
  results: [
    getApiV2AssetsRetrieveResponseMock({
      uid: 'abam8JiJ3hHTW3EYp6Tpb5',
      name: 'minimal asset first',
      owner__username: 'zefir',
      asset_type: AssetTypeName.survey,
      date_created: '2025-09-09T21:08:44.296979Z',
      date_modified: '2025-09-09T21:09:04.827003Z',
      version_id: 'vt8TMvyLRCyv26nQLcbGBi',
      deployment_status: 'draft',
      content: {
        schema: '1',
        survey: [
          {
            type: QuestionTypeName.text,
            $kuid: 'wb1gg11',
            label: ['Your name'],
            $xpath: 'Your_name',
            required: false,
            $autoname: 'Your_name',
          },
        ],
        settings: {},
        translated: ['label'],
        translations: [null],
      },
    }),
    getApiV2AssetsRetrieveResponseMock({
      uid: 'abam8JiJ3hHTW3EYp6Tpb4',
      name: 'minimal asset second',
      owner__username: 'zefir',
      asset_type: AssetTypeName.survey,
      date_created: '2025-09-11T21:08:44.296979Z',
      date_modified: '2025-09-11T21:09:04.827003Z',
      version_id: 'vt8TMvyLRCyv26nQLcbGBj',
      deployment_status: 'draft',
      content: {
        schema: '1',
        survey: [
          {
            type: QuestionTypeName.text,
            $kuid: 'wb1gg11',
            label: ['Your name'],
            $xpath: 'Your_name',
            required: false,
            $autoname: 'Your_name',
          },
        ],
        settings: {},
        translated: ['label'],
        translations: [null],
      },
    }),
  ].map(
    (asset) =>
      ({
        ...asset,
        // Override factory defaults with original mock data specifics
        owner_label: "zefir's MMO organization",
        version__content_hash:
          asset.uid === 'abam8JiJ3hHTW3EYp6Tpb5'
            ? '822573fdb551228b65ef80359b4499e62421adde'
            : '822573fdb551228b65ef80359b4499e62421addf',
        version_count: 3,
        summary: {
          geo: false,
          labels: ['Your name'],
          columns: ['type', 'label', 'required'],
          lock_all: false,
          lock_any: false,
          languages: [],
          row_count: 1,
          name_quality: {
            ok: 1,
            bad: 0,
            good: 0,
            total: 1,
            firsts: { ok: { name: 'Your_name', index: 1, label: ['Your name'] } },
          },
          default_translation: null,
        },
        report_styles: { default: {}, specified: { wb1gg11: {} }, kuid_names: { wb1gg11: 'wb1gg11' } },
      }) as unknown as AssetResponse,
  ),
}
