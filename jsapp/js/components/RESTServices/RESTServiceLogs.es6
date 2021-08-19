import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {stores} from '../../stores';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {actions} from '../../actions';
import mixins from '../../mixins';
import {dataInterface} from '../../dataInterface';
import {formatTime} from 'utils';
import {
  HOOK_LOG_STATUSES,
  MODAL_TYPES
} from '../../constants';

export default class RESTServiceLogs extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      hookName: null,
      isHookActive: false,
      assetUid: props.assetUid,
      hookUid: props.hookUid,
      isLoadingHook: true,
      isLoadingLogs: true,
      logs: [],
      nextPageUrl: null
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(
      actions.hooks.getLogs.completed,
      this.onLogsUpdated
    );

    dataInterface.getHook(this.state.assetUid, this.state.hookUid)
      .done((data) => {
        this.setState({
          isLoadingHook: false,
          hookName: data.name,
          isHookActive: data.active
        });
      })
      .fail(() => {
        this.setState({
          isLoadingHook: false
        });
        alertify.error(t('Could not load REST Service'));
      });

    actions.hooks.getLogs(
      this.state.assetUid,
      this.state.hookUid,
      {
        onComplete: (data) => {
          this.setState({
            isLoadingLogs: false,
            logs: data.results,
            nextPageUrl: data.next,
            totalLogsCount: data.count
          });
        },
        onFail: () => {
          this.setState({
            isLoadingLogs: false
          });
          alertify.error(t('Could not load REST Service logs'));
        }
      }
    );
  }

  loadMore() {
    this.setState({isLoadingLogs: false});

    dataInterface.loadNextPageUrl(this.state.nextPageUrl)
      .done((data) => {
        const newLogs = [].concat(this.state.logs, data.results);
        this.setState({
          isLoadingLogs: false,
          logs: newLogs,
          nextPageUrl: data.next,
          totalLogsCount: data.count
        });
      })
      .fail(() => {
        this.setState({isLoadingLogs: false});
        alertify.error(t('Could not load REST Service logs'));
      });
  }

  onLogsUpdated(data) {
    this.setState({logs: data.results});
  }

  retryAll() {
    const failedLogUids = [];
    this.state.logs.forEach((log) => {
      if (log.status === HOOK_LOG_STATUSES.FAILED) {
        failedLogUids.push(log.uid);
      }
    });
    this.overrideLogsStatus(failedLogUids, HOOK_LOG_STATUSES.PENDING);

    actions.hooks.retryLogs(
      this.state.assetUid,
      this.state.hookUid,
      {
        onComplete: (response) => {
          this.overrideLogsStatus(response.pending_uids, HOOK_LOG_STATUSES.PENDING);
        }
      }
    );
  }

  retryLog(log) {
    // make sure to allow only retrying failed logs
    if (log.status !== HOOK_LOG_STATUSES.FAILED) {
      return;
    }

    this.overrideLogsStatus([log.uid], HOOK_LOG_STATUSES.PENDING);

    actions.hooks.retryLog(
      this.state.assetUid,
      this.state.hookUid,
      log.uid, {
        onFail: (response) => {
          if (response.responseJSON && response.responseJSON.detail) {
            this.overrideLogMessage(log.uid, response.responseJSON.detail);
          }
          this.overrideLogsStatus([log.uid], HOOK_LOG_STATUSES.FAILED);
        }
      }
    );
  }

  overrideLogMessage(logUid, newMessage) {
    const currentLogs = this.state.logs;
    currentLogs.forEach((currentLog) => {
      if (currentLog.uid === logUid) {
        currentLog.message = newMessage;
      }
    });
    this.setState({
      logs: currentLogs
    });
  }

  // useful to mark logs as pending, before BE tells about it
  // NOTE: logUids is an array
  overrideLogsStatus(logUids, newStatus) {
    const currentLogs = this.state.logs;
    currentLogs.forEach((currentLog) => {
      if (logUids.includes(currentLog.uid)) {
        currentLog.status = newStatus;
      }
    });
    this.setState({
      logs: currentLogs
    });
  }

  showLogInfo(log) {
    const title = t('Submission Failure Detail (##id##)').replace('##id##', log.instance_id);
    const escapedMessage = $('<div/>').text(log.message).html();
    alertify.alert(title, `<pre>${escapedMessage}</pre>`);
  }

  openSubmissionModal(log) {
    const currentAsset = this.currentAsset();
    stores.pageState.switchModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: log.instance_id,
      asset: currentAsset,
      ids: [log.instance_id]
    });
  }

  hasAnyFailedLogs() {
    let hasAny = false;
    this.state.logs.forEach((log) => {
      if (log.status === HOOK_LOG_STATUSES.FAILED) {
        hasAny = true;
      }
    });
    return hasAny;
  }

  hasInfoToDisplay(log) {
    return log.status !== HOOK_LOG_STATUSES.SUCCESS && log.message.length > 0;
  }

  /*
   * rendering methods
   */

  renderHeader() {
    return (
      <header className='rest-services-list__header'>
        <a
          className='rest-services-list__header-back-button'
          href={`/#/forms/${this.state.assetUid}/settings/rest`}
        >
          <i className='k-icon k-icon-prev' />
          {t('Back to REST Services')}
        </a>

        <h2 className='rest-services-list__header-label rest-services-list__header-label--big'>
          {this.state.hookName}
        </h2>
      </header>
    );
  }

  renderLoadMoreButton() {
    if (this.state.nextPageUrl === null) {
      return null;
    }

    return (
      <bem.ServiceRowButton
        m={this.state.isLoadingLogs ? 'loading' : null}
        onClick={this.loadMore}
      >
        {this.state.isLoadingLogs ? t('Loading…') : t('Load more')}
      </bem.ServiceRowButton>
    );
  }

  renderEmptyView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <bem.FormView__cell m='rest-services-list' className='rest-services-list--empty'>
          {this.renderHeader()}

          <bem.EmptyContent>
            <bem.EmptyContent__message>
              {t('There are no logs yet')}
            </bem.EmptyContent__message>
          </bem.EmptyContent>
        </bem.FormView__cell>
      </bem.FormView>
    );
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
                { this.hasAnyFailedLogs() &&
                  <bem.ServiceRow__actionButton
                    onClick={this.retryAll.bind(this)}
                    data-tip={t('Retry all submissions')}
                    disabled={!this.state.isHookActive}
                  >
                    <i className='k-icon k-icon-replace'/>
                  </bem.ServiceRow__actionButton>
                }
              </bem.ServiceRow__column>
              <bem.ServiceRow__column m='date'>{t('Date')}</bem.ServiceRow__column>
            </bem.ServiceRow>

            {this.state.logs.map((log, n) => {
              const rowProps = {
                key: n
              };
              let statusMod = '';
              let statusLabel = '';
              if (log.status === HOOK_LOG_STATUSES.SUCCESS) {
                statusMod = 'success';
                statusLabel = t('Success');
                rowProps.m = 'clickable';
                rowProps.onClick = this.openSubmissionModal.bind(this, log);
              }
              if (log.status === HOOK_LOG_STATUSES.PENDING) {
                statusMod = 'pending';
                statusLabel = t('Pending');

                if (log.tries && log.tries > 1) {
                  statusLabel = t('Pending (##count##×)').replace('##count##', log.tries);
                }
              }
              if (log.status === HOOK_LOG_STATUSES.FAILED) {
                statusMod = 'failed';
                statusLabel = t('Failed');
              }

              return (
                <bem.ServiceRow {...rowProps}>
                  <bem.ServiceRow__column m='submission'>
                    {log.instance_id}
                  </bem.ServiceRow__column>

                  <bem.ServiceRow__column
                    m={['status', statusMod]}
                  >
                    {statusLabel}

                    {log.status === HOOK_LOG_STATUSES.FAILED &&
                      <bem.ServiceRow__actionButton
                        disabled={!this.state.isHookActive}
                        onClick={this.retryLog.bind(this, log)}
                        data-tip={t('Retry submission')}
                      >
                        <i className='k-icon k-icon-replace' />
                      </bem.ServiceRow__actionButton>
                    }

                    {this.hasInfoToDisplay(log) &&
                      <bem.ServiceRow__actionButton
                        onClick={this.showLogInfo.bind(this, log)}
                        data-tip={t('More info')}
                      >
                        <i className='k-icon k-icon-information' />
                      </bem.ServiceRow__actionButton>
                    }
                  </bem.ServiceRow__column>

                  <bem.ServiceRow__column m='date'>
                    {formatTime(log.date_modified)}
                  </bem.ServiceRow__column>
                </bem.ServiceRow>
              );
            })}
          </bem.FormView__cell>

          {this.renderLoadMoreButton()}
        </bem.FormView__cell>
      </bem.FormView>
    );
  }

  render() {
    if (this.state.isLoadingHook || (this.state.isLoadingLogs && this.state.logs.length === 0)) {
      return (<LoadingSpinner/>);
    } else if (this.state.logs.length === 0) {
      return this.renderEmptyView();
    } else {
      return this.renderListView();
    }
  }
}

reactMixin(RESTServiceLogs.prototype, Reflux.ListenerMixin);
reactMixin(RESTServiceLogs.prototype, mixins.contextRouter);

RESTServiceLogs.contextTypes = {
  router: PropTypes.object
};
