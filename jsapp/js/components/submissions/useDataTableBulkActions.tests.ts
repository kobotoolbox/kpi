import { renderHook } from '@testing-library/react'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import {
  getAssetsAdvancedFeaturesBulkActionsListQueryKey,
  useAssetsAdvancedFeaturesBulkActionsList,
} from '#/api/react-query/survey-data'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data/msw'
import { useFeatureFlag } from '#/featureFlags'
import { useSession } from '#/stores/useSession'
import { getBulkActionsPollingIntervalMs, useDataTableBulkActions } from './useDataTableBulkActions'

jest.mock('#/api/react-query/survey-data', () => {
  const actual = jest.requireActual('#/api/react-query/survey-data')
  return {
    ...actual,
    getAssetsAdvancedFeaturesBulkActionsListQueryKey: jest.fn(
      (uidAsset?: string, params?: unknown) =>
        ['api', 'v2', 'assets', uidAsset, 'advanced-features', 'bulk-actions', ...(params ? [params] : [])] as const,
    ),
    useAssetsAdvancedFeaturesBulkActionsList: jest.fn(),
  }
})

jest.mock('#/featureFlags', () => {
  return {
    FeatureFlag: {
      bulkProcessingEnabled: 'bulkProcessingEnabled',
    },
    useFeatureFlag: jest.fn(),
  }
})

jest.mock('#/stores/useSession', () => {
  return {
    useSession: jest.fn(),
  }
})

jest.mock('#/envStore', () => {
  return {
    __esModule: true,
    default: {
      data: {
        asr_mt_features_enabled: true,
      },
    },
  }
})

// Use Orval-generated mock factory for type-safe bulk action mocks
function buildBulkAction(
  status: BulkActionResponseStatusEnum,
  createdByUsername: string,
  overrides: Partial<BulkActionResponse> = {},
): BulkActionResponse {
  return getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    uid: `bulk-${status}-${createdByUsername}`,
    status,
    action_id: ActionIdEnum.automatic_google_transcription,
    question_xpath: 'Your_name',
    submission_uuids: ['submission-1'],
    params: {
      language: 'fr',
    },
    progress: 0,
    created_by: {
      username: createdByUsername,
    },
    date_created: '2026-01-01T00:00:00Z',
    date_modified: '2026-01-01T00:00:00Z',
    ...overrides,
  })
}

describe('useDataTableBulkActions', () => {
  const useFeatureFlagMock = useFeatureFlag as jest.MockedFunction<typeof useFeatureFlag>
  const useSessionMock = useSession as jest.MockedFunction<typeof useSession>
  const useBulkActionsListMock = useAssetsAdvancedFeaturesBulkActionsList as jest.MockedFunction<
    typeof useAssetsAdvancedFeaturesBulkActionsList
  >
  const getBulkActionsListQueryKeyMock = getAssetsAdvancedFeaturesBulkActionsListQueryKey as jest.MockedFunction<
    typeof getAssetsAdvancedFeaturesBulkActionsListQueryKey
  >
  const envStore = require('#/envStore').default as { data: { asr_mt_features_enabled: boolean } }

  function mockSession(username: string | undefined, isPending = false) {
    // Hook only needs username and pending state; the remaining methods are stubbed.
    useSessionMock.mockReturnValue({
      currentLoggedAccount: { username } as ReturnType<typeof useSession>['currentLoggedAccount'],
      isAnonymous: false,
      isPending,
      logOut: jest.fn(),
      logOutAll: jest.fn(),
      refreshAccount: jest.fn(),
    })
  }

  function mockBulkActions(results: BulkActionResponse[] | undefined) {
    // Return only the shape consumed by useDataTableBulkActions.
    useBulkActionsListMock.mockReturnValue({
      data: results
        ? {
            status: 200,
            data: { results },
          }
        : undefined,
    } as ReturnType<typeof useAssetsAdvancedFeaturesBulkActionsList>)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    getBulkActionsListQueryKeyMock.mockImplementation(
      (uidAsset?: string, params?: unknown) =>
        ['api', 'v2', 'assets', uidAsset, 'advanced-features', 'bulk-actions', ...(params ? [params] : [])] as const,
    )
    envStore.data.asr_mt_features_enabled = true
  })

  it('returns no active actions and false when feature flag is disabled', () => {
    useFeatureFlagMock.mockReturnValue(false)
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user'),
      buildBulkAction(BulkActionResponseStatusEnum.pending, 'other-user'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.deep.equal([])
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })

  it('returns no active actions and false when ASR/MT features are disabled in env', () => {
    useFeatureFlagMock.mockReturnValue(true)
    envStore.data.asr_mt_features_enabled = false
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user'),
      buildBulkAction(BulkActionResponseStatusEnum.pending, 'other-user'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.deep.equal([])
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })

  it('filters to pending/in-progress actions and returns true when current user has an active action', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.pending, 'zefir'),
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user'),
      buildBulkAction(BulkActionResponseStatusEnum.complete, 'other-user'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(2)
    chai
      .expect(result.current.activeBulkActions.map((action) => action.status))
      .to.deep.equal([BulkActionResponseStatusEnum.pending, BulkActionResponseStatusEnum.in_progress])
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(true)
  })

  it('returns true when all active actions were created by current user', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.pending, 'zefir'),
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'zefir'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(2)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(true)
  })

  it('returns false when current username is not available yet', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession(undefined, true)
    mockBulkActions([buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user')])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(1)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })

  it('returns true for hasActiveBulkActionsCreatedByCurrentUser when current user has active actions', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'zefir')])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(1)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(true)
  })

  it('returns false for hasActiveBulkActionsCreatedByCurrentUser when only other users have active actions', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user')])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(1)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })

  it('returns false poll interval when there are no active bulk actions', () => {
    chai.expect(getBulkActionsPollingIntervalMs([])).to.equal(false)
  })

  it('caps transcription polling interval to the maximum of 30 seconds', () => {
    const action = buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'zefir', {
      action_id: ActionIdEnum.automatic_google_transcription,
      submission_uuids: ['s-1'],
    })

    chai.expect(getBulkActionsPollingIntervalMs([action])).to.equal(30000)
  })

  it('uses a bounded fixed interval for translation polling', () => {
    const action = buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'zefir', {
      action_id: ActionIdEnum.automatic_google_translation,
      submission_uuids: ['s-1', 's-2', 's-3'],
    })

    chai.expect(getBulkActionsPollingIntervalMs([action])).to.equal(8000)
  })
})
