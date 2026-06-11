import { Box, Group, Stack, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate } from 'react-router-dom'
import { useAssetsList } from '#/api/react-query/manage-projects-and-library-content'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Button from '#/components/common/ButtonNew'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { useSession } from '#/stores/useSession'
import styles from './DeleteAccountBanner.module.scss'
import DeleteAccountModal from './DeleteAccountModal'

export default function DeleteAccountBanner() {
  const [isModalOpened, { open, close }] = useDisclosure(false)
  const navigate = useNavigate()
  const session = useSession()
  const [organization] = useOrganizationAssumed()
  const isAccountOrganizationOwner = organization.is_mmo && organization.is_owner

  const username = session.currentLoggedAccount.username
  const { data: assetsData, isPending } = useAssetsList({
    q: `(owner__username:${username})`,
    limit: 1,
  })

  const isAccountWithoutAssets = assetsData?.status === 200 ? assetsData.data.count === 0 : undefined

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
    }

    if (isPending || isAccountWithoutAssets === undefined) {
      return <Text>…</Text>
    }

    if (isAccountWithoutAssets) {
      return <Text>{t('Delete your account and all your account data.')}</Text>
    }

    return (
      <Group gap='4px'>
        <Text>
          {t(
            'You need to delete or transfer ownership of all projects owned by your user before you can delete your account.',
          )}
        </Text>

        <Button p='0' size='sm' onClick={goToProjectsList} rightIcon='arrow-right' variant='transparent'>
          {t('Go to project list')}
        </Button>
      </Group>
    )
  }

  const isAllowedToDelete = !isPending && isAccountWithoutAssets === true && !isAccountOrganizationOwner

  return (
    <Box className={styles.wrapper}>
      <Group>
        <Stack flex='1' gap='xs'>
          <Title order={3} fz='lg' fw='600'>
            {t('Delete account')}
          </Title>

          {renderMessage()}
        </Stack>

        <Button size='md' onClick={open} disabled={!isAllowedToDelete}>
          {t('Delete account')}
        </Button>

        <DeleteAccountModal opened={isModalOpened} onClose={close} />
      </Group>
    </Box>
  )
}
