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

export var KoboMatrix = React.createClass({
  getInitialState() {
    return {};
  },
  render () {
    let model = this.props.model;
    return (
        <bem.Matrix>
          <bem.MatrixCols m={'header'}>
            <bem.MatrixCols__col m={'label'} key={'label'}>
              {model.label}
            </bem.MatrixCols__col>
            {
              model.cols.map(function(col, n) {
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
              model.items.map(function(item, n) {
                return (
                  <bem.MatrixItems__item key={n}>
                    <bem.MatrixItems__itemattr m={'label'}>
                      {item.getValue('label')}
                    </bem.MatrixItems__itemattr>
                    {
                      model.cols.map(function(col, nn) {
                        return (
                            <bem.MatrixCols__col key={nn}>
                              {'🔘Yes  🔘No'}
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
});

