import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchData, fetchDelete, fetchGet, fetchPatch, fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'
import type { Json } from '#/components/common/common.interfaces'
import type { AssetTypeName } from '#/constants'
import type { AssetRequestObject, AssetResponse, AssetsRequestData } from '#/dataInterface'

function getAssetUrl(assetUid: string) {
  return endpoints.ASSET_DETAIL.replace(':uid', assetUid)
}

function searchAssets(params: AssetsRequestData) {
  // TODO https://github.com/kobotoolbox/kpi/issues/1983
  // force set limit to get hacky "all" assets
  params.limit = 200
  return fetchData(endpoints.ASSETS, 'GET', params as Json)
}

function loadAsset(assetUid: string) {
  return fetchGet<AssetResponse>(getAssetUrl(assetUid))
}

function patchAsset(assetUid: string, assetData: AssetRequestObject) {
  return fetchPatch<AssetResponse>(getAssetUrl(assetUid), assetData as unknown as Json)
}

function deleteAsset(assetUid: string) {
  return fetchDelete(getAssetUrl(assetUid))
}

interface CloneAssetRequestObject {
  clone_from: string // assetUid
  name: string
  clone_from_version_id: string
  asset_type: AssetTypeName // new asset type
  parent: string // collection assetUid
}

function cloneAsset(assetUid: string, data: CloneAssetRequestObject) {
  return fetchPost(endpoints.ASSET_CLONE.replace(':uid', assetUid), data as unknown as Json)
}

function removeAssetPermission(assetUid: string, isNonOwner: boolean) {
  return fetchDelete(endpoints.ASSET_PERMISSIONS.replace(':uid', assetUid), { isNonOwner })
}

// 3.1 List/Search Assets
export function useAssets(searchParams, options = {}) {
  return useQuery(['assets', searchParams], () => api.listAssets(searchParams), {
    ...options,
    onError(error) {
      const detail = error?.message || 'Failed to list assets'
      // your toast/notify mechanisms
      console.warn(detail)
      options.onError?.(error)
    },
  })
}

// 3.2 Load Single Asset
export function useAsset(uid, options = {}) {
  return useQuery(['asset', uid], () => api.loadAsset(uid), {
    enabled: Boolean(uid),
    ...options,
  })
}

// 3.3 “whenLoaded” helper (callback style)
export function whenAssetLoaded(uid, cb) {
  const queryClient = useQueryClient()
  if (!uid || typeof cb !== 'function') return
  queryClient
    .fetchQuery(['asset', uid], () => api.loadAsset(uid))
    .then(cb)
    .catch(console.error)
}

// 3.4 Update Asset
export function useUpdateAsset() {
  const qc = useQueryClient()
  return useMutation(api.updateAsset, {
    onSuccess(updated) {
      qc.setQueryData(['asset', updated.uid], updated)
      qc.invalidateQueries(['assets'])
    },
  })
}

// 3.5 Delete Asset
export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation(api.deleteAsset, {
    onMutate(uid) {
      // optimistic remove
      qc.setQueryData(['assets'], (old) => old?.results.filter((a) => a.uid !== uid) || [])
    },
    onError(_, uid, context) {
      // rollback if needed
      qc.setQueryData(['assets'], context.previous)
    },
    onSettled(_, __, uid) {
      qc.invalidateQueries(['assets'])
      qc.removeQueries(['asset', uid])
    },
  })
}

// 3.6 Clone Asset
export function useCloneAsset() {
  const qc = useQueryClient()
  return useMutation(api.cloneAsset, {
    onSuccess(cloned) {
      qc.invalidateQueries(['assets'])
      qc.setQueryData(['asset', cloned.uid], cloned)
    },
  })
}

// 3.7 Remove Asset Permission
export function useRemovePermission() {
  const qc = useQueryClient()
  return useMutation(api.removeAssetPermission, {
    onSuccess(_, { uid, isNonOwner }) {
      if (isNonOwner) {
        qc.invalidateQueries(['assets'])
        qc.removeQueries(['asset', uid])
      }
    },
  })
}
