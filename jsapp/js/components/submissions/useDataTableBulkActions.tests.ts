import { renderHook } from '@testing-library/react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { useAssetsAdvancedFeaturesBulkActionsList } from '#/api/react-query/survey-data'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
import { useFeatureFlag } from '#/featureFlags'
import { useSession } from '#/stores/useSession'
import { useDataTableBulkActions } from './useDataTableBulkActions'

jest.mock('#/api/react-query/survey-data', () => {
  return {
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

function buildBulkAction(
  status: BulkActionResponseStatusEnum,
  createdByUsername: string,
  overrides: Partial<BulkActionResponse> = {},
): BulkActionResponse {
  // Reuse shared factory defaults, overriding only fields relevant to this hook.
  return bulkActionFactory('submission-1', 'fr', {
    uid: `bulk-${status}-${createdByUsername}`,
    status,
    created_by: { username: createdByUsername },
    ...overrides,
  })
}

describe('useDataTableBulkActions', () => {
  const useFeatureFlagMock = useFeatureFlag as jest.MockedFunction<typeof useFeatureFlag>
  const useSessionMock = useSession as jest.MockedFunction<typeof useSession>
  const useBulkActionsListMock = useAssetsAdvancedFeaturesBulkActionsList as jest.MockedFunction<
    typeof useAssetsAdvancedFeaturesBulkActionsList
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
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(false)
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
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(false)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })

  it('filters to pending/in-progress actions and returns true when any active action is by another user', () => {
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
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(true)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(true)
  })

  it('returns false when all active actions were created by current user', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.pending, 'zefir'),
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'zefir'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(2)
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(false)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(true)
  })

  it('returns false when current username is not available yet', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession(undefined, true)
    mockBulkActions([buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user')])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(1)
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(false)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })

  it('returns true for hasActiveBulkActionsCreatedByCurrentUser when only current user has active actions', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'zefir'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(1)
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(false)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(true)
  })

  it('returns false for hasActiveBulkActionsCreatedByCurrentUser when only other users have active actions', () => {
    useFeatureFlagMock.mockReturnValue(true)
    mockSession('zefir')
    mockBulkActions([
      buildBulkAction(BulkActionResponseStatusEnum.in_progress, 'other-user'),
    ])

    const { result } = renderHook(() => useDataTableBulkActions('asset-123'))

    chai.expect(result.current.activeBulkActions).to.have.length(1)
    chai.expect(result.current.hasActiveBulkActionsCreatedByAnotherUser).to.equal(true)
    chai.expect(result.current.hasActiveBulkActionsCreatedByCurrentUser).to.equal(false)
  })
})
