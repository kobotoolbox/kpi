import { Box, Checkbox, Stack, Title } from '@mantine/core'
import React from 'react'
import { actions } from '#/actions'
import TextBox from '#/components/common/textBox'
import { ROOT_URL } from '#/constants'
import type { PermissionResponse } from '#/dataInterface'
import { ANON_USERNAME_URL } from '#/users/utils'
import permConfig from './permConfig'
import type { PermissionCodename } from './permConstants'

interface PublicShareSettingsProps {
  publicPerms: PermissionResponse[]
  assetUid: string
  userCanShare: boolean
}

class PublicShareSettings extends React.Component<PublicShareSettingsProps> {
  togglePerms(permCodename: PermissionCodename) {
    const permissionUrl = permConfig.getPermissionByCodename(permCodename)?.url
    const permission = this.props.publicPerms.find((perm) => perm.permission === permissionUrl)

    if (permission) {
      actions.permissions.removeAssetPermission(this.props.assetUid, permission.url, undefined, undefined, undefined)
    } else {
      actions.permissions.assignAssetPermission(this.props.assetUid, {
        user: ANON_USERNAME_URL,
        permission: permissionUrl,
      })
    }
  }

  render() {
    const uid = this.props.assetUid
    const url = `${ROOT_URL}/#/forms/${uid}`

    const anonCanViewPermUrl = permConfig.getPermissionByCodename('view_asset')?.url
    const anonCanViewDataPermUrl = permConfig.getPermissionByCodename('view_submissions')?.url

    const anonCanView = Boolean(this.props.publicPerms.find((perm) => perm.permission === anonCanViewPermUrl))
    const anonCanViewData = Boolean(this.props.publicPerms.find((perm) => perm.permission === anonCanViewDataPermUrl))

    return (
      <Stack gap='sm'>
        <Title order={4}>{t('Share publicly by link')}</Title>

        <Box>
          <Checkbox
            checked={anonCanView}
            disabled={!this.props.userCanShare}
            onChange={() => this.togglePerms('view_asset')}
            label={t('Anyone can view this form')}
          />
        </Box>

        <Box>
          <Checkbox
            checked={anonCanViewData}
            disabled={!this.props.userCanShare}
            onChange={() => this.togglePerms('view_submissions')}
            label={t('Anyone can view submissions made to this form')}
          />
        </Box>

        {anonCanView && <TextBox label={t('Shareable link')} type='text' readOnly value={url} />}
      </Stack>
    )
  }
}

export default PublicShareSettings
