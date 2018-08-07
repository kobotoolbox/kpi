import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import stores from '../../stores';
import bem from '../../bem';
import actions from '../../actions';
import {dataInterface} from '../../dataInterface';
import {
  t,
  formatTime
} from '../../utils';

export default class RESTServiceLogs extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      serviceName: null,
      isServiceActive: false,
      assetUid: props.assetUid,
      esid: props.esid,
      isLoadingService: true,
      isLoadingLogs: true,
      logs: []
    };
    this.STATUSES = {
      SUCCESS: 2,
      PENDING: 1,
      FAILED: 0
    }
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(
      actions.externalServices.getLogs.completed,
      this.onLogsUpdated
    );

    dataInterface.getExternalService(this.state.assetUid, this.state.esid)
      .done((data) => {
        this.setState({
          isLoadingService: false,
          serviceName: data.name,
          isServiceActive: data.active
        });
      })
      .fail((data) => {
        this.setState({
          isLoadingService: false
        });
        alertify.error(t('Could not load REST Service'));
      });

    actions.externalServices.getLogs(
      this.state.assetUid,
      this.state.esid,
      {
        onComplete: (data) => {
          this.setState({
            isLoadingLogs: false,
            logs: data.results
          });
        },
        onFail: (data) => {
          this.setState({
            isLoadingLogs: false
          });
          alertify.error(t('Could not load REST Service logs'));
        }
      }
    );
  }

  onLogsUpdated(data) {
    this.setState({
      logs: data.results
    });
  }

  retryAll(evt) {
    currentLogs.forEach((log) => {
      if (log.status === this.STATUSES.FAILED) {
        this.overrideLogStatus(log, this.STATUSES.PENDING);
      }
    });

    actions.externalServices.retryLogs(
      this.state.assetUid,
      this.state.esid,
      {
        onComplete: () => {
          alertify.warning(t('Retrying all submissions will take a while…'));
        },
        onFail: () => {
          if (data.responseJSON && data.responseJSON.detail) {
            alertify.error(data.responseJSON.detail);
          } else {
            alertify.error(t('Failed retrying all submissions'));
          }
        }
      }
    );
  }

  retryLog(log, evt) {
    // make sure to allow only retrying failed logs
    if (log.status !== this.STATUSES.FAILED) {
      return;
    }

    this.overrideLogStatus(log, this.STATUSES.PENDING);

    actions.externalServices.retryLog(
      this.state.assetUid,
      this.state.esid,
      log.uid,
      {
        onComplete: (data) => {
          if (data.status === this.STATUSES.FAILED) {
            alertify.error(t('Failed retrying submission'));
          }
        },
        onFail: (data) => {
          if (data.responseJSON && data.responseJSON.detail) {
            alertify.error(data.responseJSON.detail);
          } else {
            alertify.error(t('Failed retrying submission'));
          }
        }
      }
    );
  }

  // useful to mark log as pending, before BE tells about it
  overrideLogStatus(log, status) {
    const currentLogs = this.state.logs;
    currentLogs.forEach((currentLog) => {
      if (currentLog.uid === log.uid) {
        currentLog.status = this.STATUSES.PENDING;
      }
    });
    this.setState({
      logs: currentLogs
    })
  }

  showLogInfo(log, evt) {
    const escapedMessage = $('<div/>').text(log.message).html();
    alertify.alert(log.uid, `<pre>${escapedMessage}</pre>`);
  }

  hasAnyFailedLogs() {
    let hasAny = false;
    this.state.logs.forEach((log) => {
      if (log.status === this.STATUSES.FAILED) {
        hasAny = true;
      }
    });
    return hasAny;
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
          <i className='k-icon-prev' />
          {t('Services list')}
        </a>

        <h2 className='rest-services-list__header-label rest-services-list__header-right'>
          {this.state.serviceName}
        </h2>
      </header>
    )
  }

  renderEmptyView() {
    return (
      <bem.FormView__cell m='rest-services-list' className='rest-services-list--empty'>
        {this.renderHeader()}

        <bem.EmptyContent>
          <bem.EmptyContent__message>
            {t('There are no logs yet')}
          </bem.EmptyContent__message>
        </bem.EmptyContent>
      </bem.FormView__cell>
    );
  }

  renderListView() {
    return (
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
                  disabled={!this.state.isServiceActive}
                >
                  <i className='k-icon-replace-all'/>
                </bem.ServiceRow__actionButton>
              }
            </bem.ServiceRow__column>
            <bem.ServiceRow__column m='date'>{t('Date')}</bem.ServiceRow__column>
          </bem.ServiceRow>

          {this.state.logs.map((log, n) => {
            return (
              <bem.ServiceRow key={n} >
                <bem.ServiceRow__column m='submission'>
                  {log.uid}
                </bem.ServiceRow__column>

                <bem.ServiceRow__column
                  m='status'
                  className={log.status === this.STATUSES.FAILED ? 'service-row__error' : ''}
                >
                  {log.status_code}

                  {log.status !== this.STATUSES.SUCCESS &&
                    <bem.ServiceRow__actionButton
                      disabled={log.status === this.STATUSES.PENDING || !this.state.isServiceActive}
                      onClick={this.retryLog.bind(this, log)}
                      data-tip={t('Retry submission')}
                    >
                      <i className='k-icon-replace' />
                    </bem.ServiceRow__actionButton>
                  }

                  {log.status === this.STATUSES.FAILED && log.message.length > 0 &&
                    <bem.ServiceRow__actionButton
                      onClick={this.showLogInfo.bind(this, log)}
                      data-tip={t('More info')}
                    >
                      <i className='k-icon-information' />
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
      </bem.FormView__cell>
    );
  }

  render() {
    if (this.state.isLoadingService || this.state.isLoadingLogs) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      )
    } else if (this.state.logs.length === 0) {
      return this.renderEmptyView();
    } else {
      return this.renderListView();
    }
  }
}

reactMixin(RESTServiceLogs.prototype, Reflux.ListenerMixin);
