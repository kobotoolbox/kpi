import { Group, Stack } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import Button from '#/components/common/ButtonNew'
import type { AssetResponse, PaginatedResponse } from '#/dataInterface'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { useSession } from '#/stores/useSession'
import styles from './DeleteAccountBanner.module.scss'

interface DeleteAccountBannerProps {
  /** Internal property used in stories file. */
  storybookTestId?: string
}

export default function DeleteAccountBanner(props: DeleteAccountBannerProps) {
  const navigate = useNavigate()
  const session = useSession()
  const [isAccountWithoutAssets, setIsAccountWithoutAssets] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const username = session.currentLoggedAccount.username
    // We are fetching all user assets, but we are only interested in wheter user has at least one asset
    let singleAssetEndpoint = endpoints.ASSETS_URL + `?q=(owner__username=${username})&limit=1`
    if (props.storybookTestId) {
      singleAssetEndpoint += `&storybookTestId=${props.storybookTestId}`
    }
    fetchGet<PaginatedResponse<AssetResponse>>(singleAssetEndpoint).then((data: PaginatedResponse<AssetResponse>) => {
      console.log('data', data)
      setIsAccountWithoutAssets(data.count === 0)
    })
  }, [])

  function openModal() {
    console.log('open modal')
  }

  function goToProjectsList() {
    navigate(PROJECTS_ROUTES.MY_PROJECTS)
  }

  return (
    <div className={styles.wrapper}>
      <Group>
        <Stack flex='1' gap='xs'>
          <h3 className={styles.title}>{t('Delete account')}</h3>

          {isAccountWithoutAssets === true && (
            <p className={styles.message}>{t('Delete your account and all your account data.')}</p>
          )}

          {isAccountWithoutAssets === false && (
            <Group gap='0'>
              <p className={styles.message}>
                {t('You need to delete all projects owned by your user before you can delete your account.')}
              </p>
              &nbsp;
              <Button p='0' size='sm' onClick={goToProjectsList} rightIcon='arrow-right' variant='transparent'>
                {t('Go to project list')}
              </Button>
            </Group>
          )}

          {isAccountWithoutAssets === undefined && <p className={styles.message}>…</p>}
        </Stack>

        <Button size='md' onClick={openModal} disabled={isAccountWithoutAssets !== true}>
          {t('Delete account')}
        </Button>
      </Group>
    </div>
  )
}
