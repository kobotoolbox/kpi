import { Group } from '@mantine/core'
import { IconUserPlus } from '@tabler/icons-react'
import React from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import Avatar from '#/components/common/avatar'
import { openSharingModal } from '#/components/permissions/openSharingModal'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { ANON_USERNAME, getUsernameFromUrl } from '#/users/utils'
import styles from './FormSummary.module.scss'
import SummarySection from './SummarySection'

interface ProjectTeamProps {
  asset: AssetResponse
}

/** Unique usernames of everyone with any permission, without the anonymous user. */
function getTeamUsernames(asset: AssetResponse) {
  const usernames = asset.permissions.map((perm) => (perm.user ? getUsernameFromUrl(perm.user) : null))
  return [...new Set(usernames)].filter(
    (username): username is string => Boolean(username) && username !== ANON_USERNAME,
  )
}

/** People the project is shared with. Hidden when it's only the owner. */
export default function ProjectTeam({ asset }: ProjectTeamProps) {
  const team = getTeamUsernames(asset)

  if (team.length < 2) {
    return null
  }

  return (
    <SummarySection
      title={t('Team members')}
      titleAction={
        userCan('change_asset', asset) && (
          <ActionIcon
            size='lg'
            variant='transparent'
            icon={IconUserPlus}
            tooltip={t('Share project')}
            className={styles.teamShareButton}
            onClick={() => openSharingModal({ asset })}
          />
        )
      }
    >
      <Group gap='xs' className={styles.team}>
        {team.map((username) => (
          <Avatar key={username} username={username} size='s' isUsernameVisible />
        ))}
      </Group>
    </SummarySection>
  )
}
