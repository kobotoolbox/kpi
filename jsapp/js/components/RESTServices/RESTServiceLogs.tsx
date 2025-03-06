import React from 'react'

import alertify from 'alertifyjs'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Button from '#/components/common/button'
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
import { getRouteAssetUid } from '#/router/routerUtils'
import { formatTime, notify } from '#/utils'

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
    const title = t('Submission Failure Detail (##id##)').replace('##id##', String(log.submission_id))
    const escapedMessage = $('<div/>').text(log.message).html()
    alertify.alert(title, `<pre>${escapedMessage}</pre>`)
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

  hasInfoToDisplay(log: ExternalServiceLogResponse) {
    return log.status !== HOOK_LOG_STATUSES.SUCCESS && log.message.length > 0
  }

  /*
   * rendering methods
   */

  renderHeader() {
    return (
      <header className='rest-services-list__header'>
        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.location.assign(`/#/forms/${this.state.assetUid}/settings/rest`)
          }}
          startIcon='angle-left'
          label={t('Back to REST Services')}
        />

        <h2 className='rest-services-list__header-label rest-services-list__header-label--big'>
          {this.state.hookName}
        </h2>
      </header>
    )
  }

  renderLoadMoreButton() {
    if (this.state.nextPageUrl === null) {
      return null
    }

    return (
      <Button
        type='secondary'
        size='l'
        isPending={this.state.isLoadingLogs}
        onClick={this.loadMore.bind(this)}
        label={t('Load more')}
      />
    )
  }

  renderEmptyView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <bem.FormView__cell m='rest-services-list' className='rest-services-list--empty'>
          {this.renderHeader()}

          <bem.EmptyContent>
            <bem.EmptyContent__message>{t('There are no logs yet')}</bem.EmptyContent__message>
          </bem.EmptyContent>
        </bem.FormView__cell>
      </bem.FormView>
    )
  }

  renderListView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <bem.FormView__cell m='rest-services-list'>
          {this.renderHeader()}

          <bem.FormView__cell m={['box']}>
            <bem.ServiceRow m='header'>
              <bem.ServiceRow__column m='submission'>{t('Submission')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='status'>
                {t('Status')}
                {this.hasAnyFailedLogs() && (
                  <Button
                    type='text'
                    size='m'
                    onClick={this.retryAll.bind(this)}
                    tooltip={t('Retry all submissions')}
                    isDisabled={!this.state.isHookActive}
                    startIcon='replace'
                  />
                )}
              </bem.ServiceRow__column>
              <bem.ServiceRow__column m='date'>{t('Date')}</bem.ServiceRow__column>
            </bem.ServiceRow>

            {this.state.logs.map((log, n) => {
              const rowProps: { m?: string; onClick?: () => void } = {}
              let statusMod = ''
              let statusLabel = ''
              if (log.status === HOOK_LOG_STATUSES.SUCCESS) {
                statusMod = 'success'
                statusLabel = t('Success')
                rowProps.m = 'clickable'
                rowProps.onClick = this.openSubmissionModal.bind(this, log)
              }
              if (log.status === HOOK_LOG_STATUSES.PENDING) {
                statusMod = 'pending'
                statusLabel = t('Pending')

                if (log.tries && log.tries > 1) {
                  statusLabel = t('Pending (##count##×)').replace('##count##', String(log.tries))
                }
              }
              if (log.status === HOOK_LOG_STATUSES.FAILED) {
                statusMod = 'failed'
                statusLabel = t('Failed')
              }

              return (
                <bem.ServiceRow {...rowProps} key={n}>
                  <bem.ServiceRow__column m='submission'>{log.submission_id}</bem.ServiceRow__column>

                  <bem.ServiceRow__column m={['status', statusMod]}>
                    {statusLabel}

                    {log.status === HOOK_LOG_STATUSES.FAILED && (
                      <Button
                        type='text'
                        size='m'
                        isDisabled={!this.state.isHookActive}
                        onClick={this.retryLog.bind(this, log)}
                        tooltip={t('Retry submission')}
                        startIcon='replace'
                      />
                    )}

                    {this.hasInfoToDisplay(log) && (
                      <Button
                        type='text'
                        size='m'
                        onClick={this.showLogInfo.bind(this, log)}
                        tooltip={t('More info')}
                        startIcon='information'
                      />
                    )}
                  </bem.ServiceRow__column>

                  <bem.ServiceRow__column m='date'>{formatTime(log.date_modified)}</bem.ServiceRow__column>
                </bem.ServiceRow>
              )
            })}
          </bem.FormView__cell>

          {this.renderLoadMoreButton()}
        </bem.FormView__cell>
      </bem.FormView>
    )
  }

  render() {
    if (this.state.isLoadingHook || (this.state.isLoadingLogs && this.state.logs.length === 0)) {
      return <LoadingSpinner />
    } else if (this.state.logs.length === 0) {
      return this.renderEmptyView()
    } else {
      return this.renderListView()
    }
  }
}
