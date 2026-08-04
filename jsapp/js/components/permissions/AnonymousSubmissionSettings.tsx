import React from 'react'
import { actions } from '#/actions'
import type { PermissionResponse } from '#/dataInterface'
import { ANON_USERNAME_URL } from '#/users/utils'
import AnonymousSubmission from '../anonymousSubmission.component'
import permConfig from './permConfig'

interface AnonymousSubmissionSettingsProps {
  publicPerms: PermissionResponse[]
  assetUid: string
  userCanShare: boolean
}

/** Controls whether anonymous submissions are allowed for this project. */
const AnonymousSubmissionSettings = (props: AnonymousSubmissionSettingsProps) => {
  const anonCanAddPermUrl = permConfig.getPermissionByCodename('add_submissions')?.url
  const anonCanAddData = Boolean(props.publicPerms.find((perm) => perm.permission === anonCanAddPermUrl))

  const toggleAnonymousSubmissions = () => {
    const permissionUrl = permConfig.getPermissionByCodename('add_submissions')?.url
    const permission = props.publicPerms.find((perm) => perm.permission === permissionUrl)

    if (permission) {
      actions.permissions.removeAssetPermission(props.assetUid, permission.url, undefined, undefined, undefined)
    } else {
      actions.permissions.assignAssetPermission(props.assetUid, {
        user: ANON_USERNAME_URL,
        permission: permissionUrl,
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
