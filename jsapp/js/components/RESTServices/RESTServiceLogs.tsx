import { Group, Stack, Text, Title } from '@mantine/core'
import { IconChevronLeft, IconRefresh } from '@tabler/icons-react'
import React from 'react'
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

interface RESTServiceLogsState {
  hookName: string | null
  isHookActive: boolean
  assetUid: string
  hookUid: string
  isLoadingHook: boolean
  isLoadingLogs: boolean
  logs: ExternalServiceLogResponse[]
  totalLogsCount?: number
  nextPageUrl: string | null
}

export default class RESTServiceLogs extends React.Component<RESTServiceLogsProps, RESTServiceLogsState> {
  constructor(props: RESTServiceLogsProps) {
    super(props)
    this.state = {
      hookName: null,
      isHookActive: false,
      assetUid: props.assetUid,
      hookUid: props.hookUid,
      isLoadingHook: true,
      isLoadingLogs: true,
      logs: [],
      nextPageUrl: null,
    }
  }

  componentDidMount() {
    actions.hooks.getLogs.completed.listen(this.onLogsUpdated.bind(this))

    dataInterface
      .getHook(this.state.assetUid, this.state.hookUid)
      .done((data: ExternalServiceHookResponse) => {
        this.setState({
          isLoadingHook: false,
          hookName: data.name,
          isHookActive: data.active,
        })
      })
      .fail(() => {
        this.setState({ isLoadingHook: false })
        notify.error(t('Could not load REST Service'))
      })

    actions.hooks.getLogs(this.state.assetUid, this.state.hookUid, {
      onComplete: (data) => {
        this.setState({
          isLoadingLogs: false,
          logs: data.results,
          nextPageUrl: data.next,
          totalLogsCount: data.count,
        })
      },
      onFail: () => {
        this.setState({ isLoadingLogs: false })
        notify.error(t('Could not load REST Service logs'))
      },
    })
  }

  loadMore() {
    this.setState({ isLoadingLogs: false })

    if (this.state.nextPageUrl === null) {
      return
    }
    ;(
      dataInterface.loadNextPageUrl(this.state.nextPageUrl) as JQuery.jqXHR<
        PaginatedResponse<ExternalServiceLogResponse>
      >
    )
      .done((data) => {
        let newLogs: ExternalServiceLogResponse[] = []
        newLogs = newLogs.concat(this.state.logs, data.results)
        this.setState({
          isLoadingLogs: false,
          logs: newLogs,
          nextPageUrl: data.next,
          totalLogsCount: data.count,
        })
      })
      .fail(() => {
        this.setState({ isLoadingLogs: false })
        notify.error(t('Could not load REST Service logs'))
      })
  }

  onLogsUpdated(data: PaginatedResponse<ExternalServiceLogResponse>) {
    this.setState({ logs: data.results })
  }

  retryAll() {
    const failedLogUids: string[] = []
    this.state.logs.forEach((log) => {
      if (log.status === HOOK_LOG_STATUSES.FAILED) {
        failedLogUids.push(log.uid)
      }
    })
    this.overrideLogsStatus(failedLogUids, HOOK_LOG_STATUSES.PENDING)

    actions.hooks.retryLogs(this.state.assetUid, this.state.hookUid, {
      onComplete: (response: RetryExternalServiceLogsResponse) => {
        this.overrideLogsStatus(response.pending_uids, HOOK_LOG_STATUSES.PENDING)
      },
    })
  }

  retryLog(log: ExternalServiceLogResponse) {
    // make sure to allow only retrying failed logs
    if (log.status !== HOOK_LOG_STATUSES.FAILED) {
      return
    }

    this.overrideLogsStatus([log.uid], HOOK_LOG_STATUSES.PENDING)

    actions.hooks.retryLog(this.state.assetUid, this.state.hookUid, log.uid, {
      onFail: (response: FailResponse) => {
        if (response.responseJSON?.detail) {
          this.overrideLogMessage(log.uid, response.responseJSON.detail)
        }
        this.overrideLogsStatus([log.uid], HOOK_LOG_STATUSES.FAILED)
      },
    })
  }

  overrideLogMessage(logUid: string, newMessage: string) {
    const currentLogs = this.state.logs
    currentLogs.forEach((currentLog) => {
      if (currentLog.uid === logUid) {
        currentLog.message = newMessage
      }
    })
    this.setState({ logs: currentLogs })
  }

  // useful to mark logs as pending, before BE tells about it
  // NOTE: logUids is an array
  overrideLogsStatus(logUids: string[], newStatus: number) {
    const currentLogs = this.state.logs
    currentLogs.forEach((currentLog) => {
      if (logUids.includes(currentLog.uid)) {
        currentLog.status = newStatus
      }
    })
    this.setState({ logs: currentLogs })
  }

  showLogInfo(log: ExternalServiceLogResponse) {
    openRESTServiceLogInfoModal({ submissionId: log.submission_id, message: log.message })
  }

  openSubmissionModal(log: ExternalServiceLogResponse) {
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

  hasAnyFailedLogs() {
    let hasAny = false
    this.state.logs.forEach((log) => {
      if (log.status === HOOK_LOG_STATUSES.FAILED) {
        hasAny = true
      }
    })
    return hasAny
  }

  render() {
    if (this.state.isLoadingHook || (this.state.isLoadingLogs && this.state.logs.length === 0)) {
      return <LoadingSpinner />
    }

    const columns: Array<UniversalTableColumn<ExternalServiceLogResponse>> = [
      {
        key: 'submission_id',
        label: t('Submission'),
        grow: true,
        cellFormatter: (log) =>
          log.status === HOOK_LOG_STATUSES.SUCCESS ? (
            <ButtonNew variant='transparent' onClick={() => this.openSubmissionModal(log)}>
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
            {this.hasAnyFailedLogs() && (
              <ActionIcon
                variant='transparent'
                size='md'
                icon={IconRefresh}
                disabled={!this.state.isHookActive}
                onClick={this.retryAll.bind(this)}
                tooltip={t('Retry all submissions')}
              />
            )}
          </Group>
        ),
        cellFormatter: (log) => (
          <RESTServiceLogStatus
            log={log}
            isHookActive={this.state.isHookActive}
            onRetry={(retriedLog) => this.retryLog(retriedLog)}
            onShowInfo={(infoLog) => this.showLogInfo(infoLog)}
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
            to={ROUTES.FORM_REST.replace(':uid', this.state.assetUid)}
            leftIcon={IconChevronLeft}
          >
            {t('Back to REST Services')}
          </ButtonNew>

          <Title order={2} fz='inherit'>
            {this.state.hookName}
          </Title>
        </Group>

        {this.state.logs.length === 0 ? (
          <Text ta='center' p='xl'>
            {t('There are no logs yet')}
          </Text>
        ) : (
          <UniversalTableCore<ExternalServiceLogResponse>
            columns={columns}
            data={this.state.logs}
            bottomContent={
              this.state.nextPageUrl !== null && (
                <Group justify='center'>
                  <ButtonNew
                    variant='light'
                    size='md'
                    loading={this.state.isLoadingLogs}
                    onClick={this.loadMore.bind(this)}
                  >
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
}
