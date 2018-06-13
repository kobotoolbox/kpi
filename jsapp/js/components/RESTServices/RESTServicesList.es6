import React from 'react';
import autoBind from 'react-autobind';
import stores from '../../stores';
import bem from '../../bem';
import {t} from '../../utils';

export default class RESTServicesList extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      assetUid: props.assetUid,
      services: [
        {
          name: 'Service 1',
          rsid: 'service-1',
          count: 20
        },
        {
          name: 'Service 2',
          rsid: 'service-2',
          count: 20
        },
        {
          name: 'Service 3',
          rsid: 'service-3',
          count: 20
        }
      ]
    };
    autoBind(this);
  }

  showServiceLogs(evt) {
    console.log('logs', this.state.assetUid, evt.currentTarget.dataset.rsid);
  }

  editService(evt) {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      type: 'rest-services',
      rsid: evt.currentTarget.dataset.rsid
    });
  }

  deleteService(evt) {
    console.log('delete', this.state.assetUid, evt.currentTarget.dataset.rsid);
  }

  render() {
    return (
      <bem.FormView__cell m='rest-services-list'>
        <bem.FormView__group m='headings'>
          <bem.FormView__cell m='label'>
            {this.state.services.length} Services
          </bem.FormView__cell>
        </bem.FormView__group>

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
                  {item.name}
                </bem.ServiceRow__column>

                <bem.ServiceRow__column m='count'>
                  {item.count}
                </bem.ServiceRow__column>

                <bem.ServiceRow__column m='actions'>
                  <bem.ServiceRow__actionButton
                    onClick={this.showServiceLogs.bind(this)}
                    data-rsid={item.rsid}
                    data-tip={t('Show logs')}
                  >
                    <i className='k-icon-log' />
                  </bem.ServiceRow__actionButton>

                  <bem.ServiceRow__actionButton
                    onClick={this.editService.bind(this)}
                    data-rsid={item.rsid}
                    data-tip={t('Edit')}
                  >
                    <i className='k-icon-edit' />
                  </bem.ServiceRow__actionButton>

                  <bem.ServiceRow__actionButton
                    onClick={this.deleteService.bind(this)}
                    data-rsid={item.rsid}
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
