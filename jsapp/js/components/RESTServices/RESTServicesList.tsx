import { Anchor, Box, Group, Stack, Text, Title } from '@mantine/core'
import { IconHelpCircleFilled, IconPencil, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UniversalTableCore, { type UniversalTableColumn } from '#/UniversalTable/UniversalTableCore'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import { resolveLegacySvgIconByName } from '#/components/common/IconLegacySvgMappings'
import KoboIcon from '#/components/common/KoboIcon'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { openKoboConfirmModal } from '#/components/common/openKoboConfirmModal'
import type { ExternalServiceHookResponse, PaginatedResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { ROUTES } from '#/router/routerConstants'
import { notify } from '#/utils'
import { actions } from '../../actions'
import { openRESTServicesModal } from './openRESTServicesModal'

const REST_SERVICES_SUPPORT_URL = 'rest_services.html'

interface RESTServicesListProps {
  assetUid: string
}

export default function RESTServicesList({ assetUid }: RESTServicesListProps) {
  const [isLoadingHooks, setIsLoadingHooks] = useState(true)
  const [hooks, setHooks] = useState<ExternalServiceHookResponse[]>([])

  useEffect(() => {
    const unlisteners = [
      actions.hooks.getAll.completed.listen((data: PaginatedResponse<ExternalServiceHookResponse>) => {
        setIsLoadingHooks(false)
        setHooks(data.results)
      }),
    ]

    actions.hooks.getAll(assetUid, {
      onComplete: (data: PaginatedResponse<ExternalServiceHookResponse>) => {
        setIsLoadingHooks(false)
        setHooks(data.results)
      },
      onFail: () => {
        setIsLoadingHooks(false)
        notify.error(t('Could not load REST Services'))
      },
    })

    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [assetUid])

  const deleteHookSafe = (hookUid: string, hookName: string) => {
    if (!assetUid) {
      return
    }

    const [before, after = ''] = t('You are about to delete ##target. This action cannot be undone.').split('##target')

    openKoboConfirmModal({
      title: t('Are you sure you want to delete ##target?').replace('##target', hookName),
      children: (
        <Text>
          {before}
          <strong>{hookName}</strong>
          {after}
        </Text>
      ),
      onConfirm: () => {
        actions.hooks.delete(assetUid, hookUid)
      },
    })
  }

  const getSupportUrl = () => {
    if (envStore.isReady && envStore.data.support_url) {
      return envStore.data.support_url + REST_SERVICES_SUPPORT_URL
    }
    return undefined
  }

  if (isLoadingHooks) {
    return <LoadingSpinner />
  }

  const supportUrl = getSupportUrl()

  const columns: Array<UniversalTableColumn<ExternalServiceHookResponse>> = [
    {
      key: 'name',
      label: t('Service Name'),
      grow: true,
      cellFormatter: (hook) => (
        <Anchor
          component={Link}
          to={ROUTES.FORM_REST_HOOK.replace(':uid', assetUid).replace(':hookUid', hook.uid)}
          c={hook.active ? 'gray.2' : 'gray.4'}
          underline='not-hover'
        >
          {hook.name}
        </Anchor>
      ),
    },
    { key: 'success_count', label: t('Success'), size: 100 },
    { key: 'pending_count', label: t('Pending'), size: 100 },
    { key: 'failed_count', label: t('Failed'), size: 100 },
    {
      key: 'actions',
      label: '',
      size: 100,
      cellFormatter: (hook) => (
        <Group gap='xs' justify='flex-end' wrap='nowrap'>
          <ActionIcon
            variant='light'
            size='md'
            icon={IconPencil}
            tooltip={t('Edit')}
            onClick={() => {
              openRESTServicesModal({
                assetUid: assetUid,
                hookUid: hook.uid,
              })
            }}
          />

          <ActionIcon
            variant='danger-secondary'
            size='md'
            icon={IconTrash}
            tooltip={t('Delete')}
            onClick={() => deleteHookSafe(hook.uid, hook.name)}
          />
        </Group>
      ),
    },
  ]

  return (
    <Stack gap='md'>
      {hooks.length === 0 && (
        <Stack align='center' gap='md' p='xl' ta='center'>
          <Box c='gray.4'>
            <KoboIcon icon={resolveLegacySvgIconByName('data-sync')} size={120} />
          </Box>

          <Title order={2} fw={400}>
            {t("This project doesn't have any REST Services yet!")}
          </Title>

          <Text>
            {t('You can use REST Services to automatically post submissions to a third-party application.')}
            &nbsp;
            {supportUrl && (
              <Anchor href={supportUrl} target='_blank'>
                {t('Learn more')}
              </Anchor>
            )}
          </Text>
        </Stack>
      )}

      {hooks.length !== 0 && (
        <Stack gap='md'>
          <Group>
            <Title order={2} fz='inherit' flex={1}>
              {t('REST Services: ##number##').replace('##number##', String(hooks.length))}
            </Title>

            {supportUrl && (
              <ButtonNew
                variant='transparent'
                to={supportUrl}
                component={Link}
                target='_blank'
                leftIcon={IconHelpCircleFilled}
              >
                {t('Need help?')}
              </ButtonNew>
            )}
          </Group>

          <UniversalTableCore<ExternalServiceHookResponse> columns={columns} data={hooks} />
        </Stack>
      )}

      <Group justify='flex-end'>
        <ButtonNew
          onClick={() => {
            openRESTServicesModal({
              assetUid: assetUid,
              // hookUid: not provided intentionally
            })
          }}
          size='lg'
        >
          {t('Register a New Service')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
