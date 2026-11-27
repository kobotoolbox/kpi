import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import {
  useAssetsPermissionAssignmentsCreate,
  useAssetsPermissionAssignmentsDestroy,
} from '#/api/react-query/manage-permissions'
import { getAssetsRetrieveQueryKey } from '#/api/react-query/manage-projects-and-library-content'
import type { PermissionResponse } from '#/dataInterface'
import { ANON_USERNAME_URL } from '#/users/utils'
import { notify } from '#/utils'
import AnonymousSubmission from '../anonymousSubmission.component'
import permConfig from './permConfig'

interface AnonymousSubmissionSettingsProps {
  publicPerms: PermissionResponse[]
  assetUid: string
  userCanShare: boolean
}

/** Controls whether anonymous submissions are allowed for this project. */
const AnonymousSubmissionSettings = (props: AnonymousSubmissionSettingsProps) => {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAssetsRetrieveQueryKey(props.assetUid) })

  const createPermission = useAssetsPermissionAssignmentsCreate({ mutation: { onSettled: invalidate } })
  const destroyPermission = useAssetsPermissionAssignmentsDestroy({ mutation: { onSettled: invalidate } })

  const anonCanAddPermUrl = permConfig.getPermissionByCodename('add_submissions')?.url
  const anonCanAddData = Boolean(props.publicPerms.find((perm) => perm.permission === anonCanAddPermUrl))

  const toggleAnonymousSubmissions = () => {
    const permissionUrl = permConfig.getPermissionByCodename('add_submissions')?.url
    const permission = props.publicPerms.find((perm) => perm.permission === permissionUrl)

    if (permission) {
      const assignmentUid = permission.url.split('/').filter(Boolean).at(-1)
      if (!assignmentUid) {
        notify.error(t('Failed to update permissions'))
        return
      }
      destroyPermission.mutate({ uidAsset: props.assetUid, uidPermissionAssignment: assignmentUid })
    } else {
      if (!permissionUrl) {
        notify.error(t('Failed to update permissions'))
        return
      }
      createPermission.mutate({
        uidAsset: props.assetUid,
        data: { user: ANON_USERNAME_URL, permission: permissionUrl },
      })
    }
  }

  return (
    <AnonymousSubmission
      checked={anonCanAddData}
      disabled={!props.userCanShare}
      onChange={toggleAnonymousSubmissions}
    />
  )
}

export default AnonymousSubmissionSettings
