import React from 'react'
import { actions } from '#/actions'
import NewFeatureDialog from '#/components/newFeatureDialog.component'
import { HELP_ARTICLE_ANON_SUBMISSIONS_URL } from '#/constants'
import type { PermissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
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
    <NewFeatureDialog
      content={t(
        'You can now control whether to allow anonymous submissions for each project. Previously, this was an account-wide setting.',
      )}
      supportArticle={envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL}
      featureKey='anonymousSubmissions'
      pointerClass='anonymousSubmissionPointer'
      dialogClass='anonymousSubmissionDialog'
    >
      <AnonymousSubmission
        checked={anonCanAddData}
        disabled={!props.userCanShare}
        onChange={toggleAnonymousSubmissions}
      />
    </NewFeatureDialog>
  )
}

export default AnonymousSubmissionSettings
