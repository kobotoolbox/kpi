import React from 'react';
import { bemComponents } from 'js/libs/reactBemComponents';

const bem = bemComponents({
  Matrix: 'kobomatrix',
  MatrixCols: 'matrix-cols',
  MatrixCols__col: 'matrix-cols__col',
  MatrixCols__colattr: ['matrix-cols__colattr', '<span>'],
  MatrixItems: ['matrix-items', '<ul>'],
  MatrixItems__item: ['matrix-items__item', '<li>'],
  MatrixItems__itemattr: ['matrix-items__itemattr', '<span>'],
  MatrixButton: ['kobomatrix-button', '<button>'],
});

class KoboMatrix extends React.Component {
  constructor () {
    super();
    this.state = {};
  }
  render () {
    const model = this.props.model;
    const label = model.get('label'),
          cols = model.get('cols'),
          items = model.get('items');

    return (
        <bem.Matrix>
          <bem.MatrixCols m={'header'}>
            <bem.MatrixCols__col m={'label'} key={'label'}>
              {label}
            </bem.MatrixCols__col>
            {
              cols.map(function(colKuid, n) {
                let col = model.get(colKuid);
                return (
                    <bem.MatrixCols__col key={n} m={'header'}>
                      <bem.MatrixCols__colattr m={'label'}>
                        {col.get('label')}
                      </bem.MatrixCols__colattr>
                      <bem.MatrixCols__colattr m={'type'}>
                        {' ('}
                        {col.get('type')}
                        {')'}
                      </bem.MatrixCols__colattr>
                    </bem.MatrixCols__col>
                  );
              })
            }
          </bem.MatrixCols>
          <bem.MatrixItems>
            {
              items.map(function(itemKuid, n) {
                const item = model.get(itemKuid);
                return (
                  <bem.MatrixItems__item key={n}>
                    <bem.MatrixItems__itemattr m={'label'}>
                      {item.get('label')}
                    </bem.MatrixItems__itemattr>
                    {
                      cols.map(function(colKuid, nn) {
                        const col = model.get(colKuid),
                          _listName = col.get('select_from_list_name'),
                          _type = col.get('type');
                        let _isUnderscores = false,
                          contents = [];
                        if (_listName) {
                          let list = model.getListDetails(colKuid);
                          let listStyleChar = '🔘';
                          list.forEach(function(item){
                            contents.push(`${listStyleChar}${item.label}`);
                          });
                        } else {
                          _isUnderscores = true;
                          contents = ['_________'];
                        }
                        return (
                          <bem.MatrixCols__col key={colKuid} m={{
                            list: !!_listName,
                            underscores: _isUnderscores,
                          }}>
                            {contents.join(' ')}
                          </bem.MatrixCols__col>
                        );
                      })
                    }
                  </bem.MatrixItems__item>
                );
              })
            }
          </bem.MatrixItems>
        </bem.Matrix>
      )
  }
}

export default KoboMatrix;