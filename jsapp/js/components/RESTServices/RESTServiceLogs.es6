import $ from 'jquery';
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
      assetUid: props.assetUid,
      esid: props.esid,
      isLoadingService: true,
      isLoadingLogs: true,
      logs: [],
      pendingRetries: {}
    };
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
          serviceName: data.name
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

  retryAllSubmissions(evt) {
    const pendingRetries = {};
    this.state.logs.forEach((log) => {
      pendingRetries[log.uid] = true;
    });
    this.setState({
      pendingRetries: pendingRetries
    });

    actions.externalServices.retryLogs(
      this.state.assetUid,
      this.state.esid,
      {
        onComplete: () => {
          this.setState({
            pendingRetries: {}
          });
          alertify.warning(t('Retrying all submissions will take a while…'));
        },
        onFail: () => {
          this.setState({
            pendingRetries: {}
          });

          alertify.error(t('Failed retrying all submissions'));
        }
      }
    );
  }

  retrySubmission(submission, evt) {
    this.setState({
      pendingRetries: {[submission.uid]: true}
    });

    actions.externalServices.retryLog(
      this.state.assetUid,
      this.state.esid,
      submission.uid,
      {
        onComplete: (data) => {
          this.setState({
            pendingRetries: {[submission.uid]: false}
          });

          if (data.success === false) {
            alertify.error(t('Failed retrying submission'));
          }
        },
        onFail: (data) => {
          this.setState({
            pendingRetries: {[submission.uid]: false}
          });

          alertify.error(t('Failed retrying submission'));
        }
      }
    );
  }

  showSubmissionInfo(submission, evt) {
    const escapedMessage = $('<div/>').text(submission.message).html();
    alertify.alert(
      submission.uid,
      `<pre>${escapedMessage}</pre>`
    );
  }

  isStatusSuccessful(statusCode) {
    return (200 <= statusCode && statusCode <= 299);
  }

  hasAnyFailedSubmission() {
    let hasAny = false;
    this.state.logs.forEach((log) => {
      if (!this.isStatusSuccessful(log.status_code)) {
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
              { this.hasAnyFailedSubmission() &&
                <bem.ServiceRow__actionButton
                  onClick={this.retryAllSubmissions.bind(this)}
                  data-tip={t('Retry all submissions')}
                >
                  <i className='k-icon-replace-all'/>
                </bem.ServiceRow__actionButton>
              }
            </bem.ServiceRow__column>
            <bem.ServiceRow__column m='date'>{t('Date')}</bem.ServiceRow__column>
          </bem.ServiceRow>

          {this.state.logs.map((item, n) => {
            return (
              <bem.ServiceRow key={n} >
                <bem.ServiceRow__column m='submission'>
                  {item.uid}
                </bem.ServiceRow__column>

                <bem.ServiceRow__column
                  m='status'
                  className={this.isStatusSuccessful(item.status_code) ? '' : 'service-row__error'}
                >
                  {item.status_code}

                  {!this.isStatusSuccessful(item.status_code) &&
                    <bem.ServiceRow__actionButton
                      disabled={this.state.pendingRetries[item.uid] === true}
                      onClick={this.retrySubmission.bind(this, item)}
                      data-tip={t('Retry submission')}
                    >
                      <i className='k-icon-replace' />
                    </bem.ServiceRow__actionButton>
                  }

                  {!this.isStatusSuccessful(item.status_code) && item.message.length > 0 &&
                    <bem.ServiceRow__actionButton
                      onClick={this.showSubmissionInfo.bind(this, item)}
                      data-tip={t('More info')}
                    >
                      <i className='k-icon-information' />
                    </bem.ServiceRow__actionButton>
                  }
                </bem.ServiceRow__column>

                <bem.ServiceRow__column m='date'>
                  {formatTime(item.date_modified)}
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
