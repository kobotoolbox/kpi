import React from 'react';
import autoBind from 'react-autobind';
import bem from '../../bem';
import {t} from '../../utils';

export default class RESTServicesList extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
    autoBind(this);
  }

  render() {
    const services = [
      {
        name: 'Service 1',
        count: 20
      },
      {
        name: 'Service 2',
        count: 20
      },
      {
        name: 'Service 3',
        count: 20
      }
    ];

    return (
      <bem.FormView__cell m='REST-services-list'>
        <bem.FormView__group m='headings'>
          <bem.FormView__cell m='label'>
            X Services
          </bem.FormView__cell>
        </bem.FormView__group>
        <bem.FormView__cell m={['REST-services-table', 'box']}>
          <bem.FormView__group>
            <bem.FormView__group m={['items', 'headings']}>
              <bem.FormView__label m='name'>{t('Service Name')}</bem.FormView__label>
              <bem.FormView__label m='count'>{t('Count')}</bem.FormView__label>
              <bem.FormView__label m='actions' />
            </bem.FormView__group>

            {services.map((item, n) => {
              return (
                <bem.FormView__group m='items' key={n} >
                  <bem.FormView__label m='name'>
                    {item.name}
                  </bem.FormView__label>
                  <bem.FormView__label m='count'>
                    {item.count}
                  </bem.FormView__label>
                  <bem.FormView__label m='actions'>
                    ACTIONS
                  </bem.FormView__label>
                </bem.FormView__group>
              );
            })}
          </bem.FormView__group>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}
