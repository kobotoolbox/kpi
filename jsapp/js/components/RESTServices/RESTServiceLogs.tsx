import { Group, Stack, Text, Title } from '@mantine/core'
import { IconChevronLeft, IconRefresh } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UniversalTableCore, { type UniversalTableColumn } from '#/UniversalTable/UniversalTableCore'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { HOOK_LOG_STATUSES, MODAL_TYPES } from '#/constants'
import { dataInterface } from '#/dataInterface'
import type {
  ExternalServiceHookResponse,
  ExternalServiceLogResponse,
  FailResponse,
  PaginatedResponse,
  RetryExternalServiceLogsResponse,
} from '#/dataInterface'
import pageState from '#/pageState.store'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid } from '#/router/routerUtils'
import { formatTime, notify } from '#/utils'
import RESTServiceLogStatus from './RESTServiceLogStatus'
import { openRESTServiceLogInfoModal } from './openRESTServiceLogInfoModal'

interface RESTServiceLogsProps {
  assetUid: string
  hookUid: string
}

export default function RESTServiceLogs({ assetUid, hookUid }: RESTServiceLogsProps) {
  const [hookName, setHookName] = useState<string | null>(null)
  const [isHookActive, setIsHookActive] = useState(false)
  const [isLoadingHook, setIsLoadingHook] = useState(true)
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [logs, setLogs] = useState<ExternalServiceLogResponse[]>([])
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null)

  useEffect(() => {
    const unlisteners = [
      actions.hooks.getLogs.completed.listen((data: PaginatedResponse<ExternalServiceLogResponse>) => {
        setLogs(data.results)
      }),
    ]

    dataInterface
      .getHook(assetUid, hookUid)
      .done((data: ExternalServiceHookResponse) => {
        setIsLoadingHook(false)
        setHookName(data.name)
        setIsHookActive(data.active)
      })
      .fail(() => {
        setIsLoadingHook(false)
        notify.error(t('Could not load REST Service'))
      })

    actions.hooks.getLogs(assetUid, hookUid, {
      onComplete: (data: PaginatedResponse<ExternalServiceLogResponse>) => {
        setIsLoadingLogs(false)
        setLogs(data.results)
        setNextPageUrl(data.next)
      },
      onFail: () => {
        setIsLoadingLogs(false)
        notify.error(t('Could not load REST Service logs'))
      },
    })

    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [assetUid, hookUid])

  const loadMore = () => {
    if (nextPageUrl === null) {
      return
    }

    setIsLoadingLogs(true)
    ;(dataInterface.loadNextPageUrl(nextPageUrl) as JQuery.jqXHR<PaginatedResponse<ExternalServiceLogResponse>>)
      .done((data) => {
        setIsLoadingLogs(false)
        setLogs((currentLogs) => [...currentLogs, ...data.results])
        setNextPageUrl(data.next)
      })
      .fail(() => {
        setIsLoadingLogs(false)
        notify.error(t('Could not load REST Service logs'))
      })
  }

  // useful to mark logs as pending, before BE tells about it
  // NOTE: logUids is an array
  const overrideLogsStatus = (logUids: string[], newStatus: number) => {
    setLogs((currentLogs) =>
      currentLogs.map((log) => (logUids.includes(log.uid) ? { ...log, status: newStatus } : log)),
    )
  }

  const overrideLogMessage = (logUid: string, newMessage: string) => {
    setLogs((currentLogs) => currentLogs.map((log) => (log.uid === logUid ? { ...log, message: newMessage } : log)))
  }

  const retryAll = () => {
    const failedLogUids = logs.filter((log) => log.status === HOOK_LOG_STATUSES.FAILED).map((log) => log.uid)
    overrideLogsStatus(failedLogUids, HOOK_LOG_STATUSES.PENDING)

    actions.hooks.retryLogs(assetUid, hookUid, {
      onComplete: (response: RetryExternalServiceLogsResponse) => {
        overrideLogsStatus(response.pending_uids, HOOK_LOG_STATUSES.PENDING)
      },
    })
  }

  const retryLog = (log: ExternalServiceLogResponse) => {
    // make sure to allow only retrying failed logs
    if (log.status !== HOOK_LOG_STATUSES.FAILED) {
      return
    }

    overrideLogsStatus([log.uid], HOOK_LOG_STATUSES.PENDING)

    actions.hooks.retryLog(assetUid, hookUid, log.uid, {
      onFail: (response: FailResponse) => {
        if (response.responseJSON?.detail) {
          overrideLogMessage(log.uid, response.responseJSON.detail)
        }
        overrideLogsStatus([log.uid], HOOK_LOG_STATUSES.FAILED)
      },
    })
  }

  const showLogInfo = (log: ExternalServiceLogResponse) => {
    openRESTServiceLogInfoModal({ submissionId: log.submission_id, message: log.message })
  }

  const openSubmissionModal = (log: ExternalServiceLogResponse) => {
    const currentAssetUid = getRouteAssetUid()
    if (currentAssetUid !== null) {
      const currentAsset = assetStore.getAsset(currentAssetUid)
      pageState.switchModal({
        type: MODAL_TYPES.SUBMISSION,
        sid: log.submission_id,
        asset: currentAsset,
        ids: [log.submission_id],
      })
    }
  }

  const hasAnyFailedLogs = () => logs.some((log) => log.status === HOOK_LOG_STATUSES.FAILED)

  if (isLoadingHook || (isLoadingLogs && logs.length === 0)) {
    return <LoadingSpinner />
  }

  const columns: Array<UniversalTableColumn<ExternalServiceLogResponse>> = [
    {
      key: 'submission_id',
      label: t('Submission'),
      grow: true,
      cellFormatter: (log) =>
        log.status === HOOK_LOG_STATUSES.SUCCESS ? (
          <ButtonNew variant='transparent' onClick={() => openSubmissionModal(log)}>
            {log.submission_id}
          </ButtonNew>
        ) : (
          log.submission_id
        ),
    },
    {
      key: 'status',
      label: (
        <Group gap='xs' wrap='nowrap'>
          {t('Status')}
          {hasAnyFailedLogs() && (
            <ActionIcon
              variant='transparent'
              size='md'
              icon={IconRefresh}
              disabled={!isHookActive}
              onClick={retryAll}
              tooltip={t('Retry all submissions')}
            />
          )}
        </Group>
      ),
      cellFormatter: (log) => (
        <RESTServiceLogStatus
          log={log}
          isHookActive={isHookActive}
          onRetry={(retriedLog) => retryLog(retriedLog)}
          onShowInfo={(infoLog) => showLogInfo(infoLog)}
        />
      ),
    },
    {
      key: 'date_modified',
      label: t('Date'),
      cellFormatter: (log) => formatTime(log.date_modified),
    },
  ]

  return (
    <Stack gap='md'>
      <Group>
        <ButtonNew
          size='md'
          variant='light'
          component={Link}
          to={ROUTES.FORM_REST.replace(':uid', assetUid)}
          leftIcon={IconChevronLeft}
        >
          {t('Back to REST Services')}
        </ButtonNew>

        <Title order={2} fz='inherit'>
          {hookName}
        </Title>
      </Group>

      {logs.length === 0 ? (
        <Text ta='center' p='xl'>
          {t('There are no logs yet')}
        </Text>
      ) : (
        <UniversalTableCore<ExternalServiceLogResponse>
          columns={columns}
          data={logs}
          bottomContent={
            nextPageUrl !== null && (
              <Group justify='center'>
                <ButtonNew variant='light' size='md' loading={isLoadingLogs} onClick={loadMore}>
                  {t('Load more')}
                </ButtonNew>
              </Group>
            )
          }
        />
      )}
    </Stack>
  )
}
