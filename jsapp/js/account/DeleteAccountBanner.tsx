import { Group, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import Button from '#/components/common/ButtonNew'
import type { AssetResponse, PaginatedResponse } from '#/dataInterface'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { useSession } from '#/stores/useSession'
import styles from './DeleteAccountBanner.module.scss'
import DeleteAccountModal from './DeleteAccountModal'
import { useOrganizationQuery } from './organization/organizationQuery'

interface DeleteAccountBannerProps {
  /** Internal property used in stories file. */
  storybookTestId?: string
}

export default function DeleteAccountBanner(props: DeleteAccountBannerProps) {
  const [isModalOpened, { open, close }] = useDisclosure(false)
  const navigate = useNavigate()
  const session = useSession()
  const orgQuery = useOrganizationQuery()
  const [isAccountWithoutAssets, setIsAccountWithoutAssets] = useState<boolean | undefined>(undefined)
  const isAccountOrganizationOwner = orgQuery.data?.is_mmo && orgQuery.data?.is_owner

  useEffect(() => {
    const username = session.currentLoggedAccount.username
    // We are fetching all user assets, but we are only interested in wheter user has at least one asset
    let singleAssetEndpoint = endpoints.ASSETS_URL + `?q=(owner__username:${username})&limit=1`
    if (props.storybookTestId) {
      singleAssetEndpoint += `&storybookTestId=${props.storybookTestId}`
    }
    fetchGet<PaginatedResponse<AssetResponse>>(singleAssetEndpoint).then((data: PaginatedResponse<AssetResponse>) => {
      setIsAccountWithoutAssets(data.count === 0)
    })
  }, [])

  function goToProjectsList() {
    navigate(PROJECTS_ROUTES.MY_PROJECTS)
  }

  function renderMessage() {
    if (isAccountOrganizationOwner) {
      return (
        <Text>
          {t(
            'You need to transfer ownership of your organization before you can delete your account. Please contact the server administrator.',
          )}
        </Text>
      )
    } else if (isAccountWithoutAssets === true) {
      return <Text>{t('Delete your account and all your account data.')}</Text>
    } else if (isAccountWithoutAssets === false) {
      return (
        <Group gap='4px'>
          <Text>{t('You need to delete all projects owned by your user before you can delete your account.')}</Text>

          <Button p='0' size='sm' onClick={goToProjectsList} rightIcon='arrow-right' variant='transparent'>
            {t('Go to project list')}
          </Button>
        </Group>
      )
    } else {
      return <Text>…</Text>
    }
  }

  const isAllowedToDelete = isAccountWithoutAssets && !isAccountOrganizationOwner

  return (
    <div className={styles.wrapper}>
      <Group>
        <Stack flex='1' gap='xs'>
          <Title order={3} m="0" fz="16px" fw="600">{t('Delete account')}</Title>

          {renderMessage()}
        </Stack>

        <Button size='md' onClick={open} disabled={!isAllowedToDelete}>
          {t('Delete account')}
        </Button>

        <DeleteAccountModal opened={isModalOpened} onClose={close} />
      </Group>
    </div>
  )
}
