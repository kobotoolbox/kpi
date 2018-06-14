import React from 'react';
import autoBind from 'react-autobind';
import stores from '../../stores';
import bem from '../../bem';
import {
  t,
  formatTime
} from '../../utils';

export default class RESTServiceLogs extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      serviceName: 'TODO',
      assetUid: props.assetUid,
      rsid: props.rsid,
      serviceLogs: [
        {
          name: 'Submission 1',
          sid: 'submission-1',
          date: 'Thu Jun 14 2018 11:31:38 GMT+0200 (Central European Summer Time)',
          status: 'sent'
        },
        {
          name: 'Submission 2',
          sid: 'submission-2',
          date: 'Thu Jun 12 2018 10:00:00 GMT+0200 (Central European Summer Time)',
          status: 'failed'
        }
      ]
    };
    autoBind(this);
  }

  retrySubmission(submission, evt) {
    console.log('retrySubmission', submission);
  }

  render() {
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
}
