import React from 'react';
import autoBind from 'react-autobind';
import stores from '../../stores';
import actions from '../../actions';
import bem from '../../bem';
import {t} from '../../utils';

import {RESTServicesSupportUrl} from '../RESTServices';

export default class RESTServicesList extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      assetUid: props.assetUid,
      services: [
        {
          name: 'Backup clone of master project',
          esid: 'backup-clone-of-master-project',
          totalCount: 198,
          failedCount: 0
        },
        {
          name: 'Ricky\'s API',
          esid: 'ricky-s-api',
          totalCount: 2057,
          failedCount: 341
        },
        {
          name: 'Ricky`\s API v3',
          esid: 'ricky-s-api-3',
          totalCount: 8045,
          failedCount: 1
        }
      ]
    };
    autoBind(this);
  }

  editService(evt) {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      type: 'rest-services',
      esid: evt.currentTarget.dataset.esid
    });
  }

  deleteService(evt) {
    actions.externalServices.delete(
      this.state.assetUid,
      evt.currentTarget.dataset.esid, {
        onComplete: () => {
          console.log('deleted');
        },
        onFail: () => {
          console.log('del failed');
        }
      }
    );
  }

  render() {
    return (
      <bem.FormView__cell m='rest-services-list'>
        <header className='rest-services-list__header'>
          <h2 className='rest-services-list__header-label'>
            {t('##number## Services').replace('##number##', this.state.services.length)}
          </h2>

          <a
            className='rest-services-list__header-help-link'
            href={RESTServicesSupportUrl}
            target='_blank'
          >{t('Need help?')}</a>
        </header>

        <bem.FormView__cell m={['box']}>
          <bem.ServiceRow m='header'>
            <bem.ServiceRow__column m='name'>{t('Service Name')}</bem.ServiceRow__column>
            <bem.ServiceRow__column m='count'>{t('Count')}</bem.ServiceRow__column>
            <bem.ServiceRow__column m='actions' />
          </bem.ServiceRow>

          {this.state.services.map((item, n) => {
            return (
              <bem.ServiceRow key={n} >
                <bem.ServiceRow__column m='name'>
                  <a href={`/#/forms/${this.state.assetUid}/settings/rest/${item.esid}`}>{item.name}</a>
                </bem.ServiceRow__column>

                <bem.ServiceRow__column m='count'>
                  {item.totalCount}
                  {item.failedCount &&
                    <span className='service-row__error'>
                      &nbsp;({item.failedCount})
                    </span>
                  }
                </bem.ServiceRow__column>

                <bem.ServiceRow__column m='actions'>
                  <bem.ServiceRow__actionButton
                    onClick={this.editService}
                    data-esid={item.esid}
                    data-tip={t('Edit')}
                  >
                    <i className='k-icon-edit' />
                  </bem.ServiceRow__actionButton>

                  <bem.ServiceRow__actionButton
                    onClick={this.deleteService}
                    data-esid={item.esid}
                    data-tip={t('Delete')}
                  >
                    <i className='k-icon-trash' />
                  </bem.ServiceRow__actionButton>
                </bem.ServiceRow__column>
              </bem.ServiceRow>
            );
          })}
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}
