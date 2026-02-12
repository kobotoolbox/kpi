import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import React from 'react'
import { Link } from 'react-router-dom'
import type { Asset } from '#/api/models/asset'
import type { AssetResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid } from '#/router/routerUtils'
import AssetName from '../components/common/assetName'
import Badge from '../components/common/badge'
import Icon from '../components/common/icon'
import { userCan } from '../components/permissions/utils'
import styles from './SidebarFormsList.module.scss'

interface SidebarFormsListCategoryProps {
  onToggleClick: () => void
  iconName: IconName
  label: string
  isOpen: boolean
  projects: Asset[]
}

/**
 * Displays a toggleable button and a list of projects
 */
export default function SidebarFormsListCategory(props: SidebarFormsListCategoryProps) {
  return (
    <>
      <UnstyledButton size='md' variant='transparent' onClick={props.onToggleClick} className={styles.categoryButton}>
        <Group gap='xs'>
          <Icon name={props.iconName} size='l' className={styles.categoryButtonIcon} />
          <Box flex={1}>{props.label}</Box>
          <Badge label={props.projects.length} color='light-storm' size='xs' />
        </Group>
      </UnstyledButton>

      {props.isOpen && (
        <Stack className={styles.categoryList} gap='0'>
          {props.projects.map((assetOriginal: Asset) => {
            // TODO: because of a bug in OpenAPI schema, we can't use `userCan` easily. We cast it here until it is fixed.
            // See: https://linear.app/kobotoolbox/issue/DEV-1727/
            const asset = assetOriginal as unknown as AssetResponse

            let href = ROUTES.FORM.replace(':uid', asset.uid)
            if (userCan('view_submissions', asset) && asset.has_deployment && asset.deployment__submission_count) {
              href = ROUTES.FORM_SUMMARY.replace(':uid', asset.uid)
            } else {
              href = ROUTES.FORM_LANDING.replace(':uid', asset.uid)
            }

            const isActiveProject = asset.uid === getRouteAssetUid()

            return (
              <Link
                to={href}
                key={asset.uid}
                style={{ background: isActiveProject ? 'var(--mantine-color-gray-7)' : 'transparent' }}
                className={styles.projectLink}
              >
                <Text fz='12' p='3 6'>
                  <AssetName asset={asset} />
                </Text>
              </Link>
            )
          })}
        </Stack>
      )}
    </>
  )
}
