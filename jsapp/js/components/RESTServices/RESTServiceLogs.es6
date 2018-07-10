import React from 'react';
import autoBind from 'react-autobind';
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
      logs: []
    };
    autoBind(this);
  }

  componentDidMount() {
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
    dataInterface.getExternalServiceLogs(this.state.assetUid, this.state.esid)
      .done((data) => {
        this.setState({
          isLoadingLogs: false,
          logs: data.results
        });
      })
      .fail((data) => {
        this.setState({
          isLoadingLogs: false
        });
        alertify.error(t('Could not load REST Service logs'));
      });
  }

  retrySubmission(submission, evt) {
    console.log('retrySubmission', submission);
  }

  /*
   * rendering methods
   */

  renderEmptyView() {
    return (
      <bem.FormView__cell m='rest-services-list' className='rest-services-list--empty'>
        <header className='rest-services-list__header'>
          <a
            className='rest-services-list__header-back-button'
            href={`/#/forms/${this.state.assetUid}/settings/rest`}
          >
            <i className='k-icon-prev' />
          </a>

          <h2 className='rest-services-list__header-label'>
            {t('##name## activity logs').replace('##name##', this.state.serviceName)}
          </h2>
        </header>

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
        <header className='rest-services-list__header'>
          <a
            className='rest-services-list__header-back-button'
            href={`/#/forms/${this.state.assetUid}/settings/rest`}
          >
            <i className='k-icon-prev' />
          </a>

          <h2 className='rest-services-list__header-label'>
            {t('##name## activity logs').replace('##name##', this.state.serviceName)}
          </h2>
        </header>

        <bem.FormView__cell m={['box']}>
          <bem.ServiceRow m='header'>
            <bem.ServiceRow__column m='submission'>{t('Submission')}</bem.ServiceRow__column>
            <bem.ServiceRow__column m='status'>{t('Status')}</bem.ServiceRow__column>
            <bem.ServiceRow__column m='date'>{t('Date')}</bem.ServiceRow__column>
          </bem.ServiceRow>

          {this.state.serviceLogs.map((item, n) => {
            return (
              <bem.ServiceRow key={n} >
                <bem.ServiceRow__column m='submission'>
                  {item.name}
                </bem.ServiceRow__column>

                <bem.ServiceRow__column
                  m='status'
                  className={item.status === 'failed' ? 'service-row__error' : ''}
                >
                  {item.status}

                  {item.status === 'failed' &&
                    <bem.ServiceRow__actionButton
                      onClick={this.retrySubmission.bind(this, item)}
                      data-tip={t('Retry submission')}
                    >
                      <i className='k-icon-replace' />
                    </bem.ServiceRow__actionButton>
                  }
                </bem.ServiceRow__column>

                <bem.ServiceRow__column m='date'>
                  {formatTime(item.date)}
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
