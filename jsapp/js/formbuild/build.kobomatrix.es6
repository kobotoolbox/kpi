import React from 'react/addons';
import bem from 'js/bem';

const Matrix = bem.create('kobomatrix', '<div>'),
      MatrixCols = bem.create('matrix-cols'),
      MatrixCols__col = bem.create('matrix-cols__col'),
      MatrixCols__colattr = bem.create('matrix-cols__colattr', '<span>'),
      MatrixItems = bem.create('matrix-items', '<ul>'),
      MatrixItems__item = bem.create('matrix-items__item', '<li>'),
      MatrixItems__itemattr = bem.create('matrix-items__itemattr', '<span>'),
      MatrixButton = bem.create('kobomatrix-button', '<button>');

export var KoboMatrix = React.createClass({
  getInitialState() {
    return {};
  },
  render () {
    let model = this.props.model;
    return (
        <Matrix>
          <MatrixCols m={'header'}>
            <MatrixCols__col m={'label'} key={'label'}>
              {model.label}
            </MatrixCols__col>
            {
              model.cols.map(function(col, n) {
                return (
                    <MatrixCols__col key={n} m={'header'}>
                      <MatrixCols__colattr m={'label'}>
                        {col.get('label')}
                      </MatrixCols__colattr>
                      <MatrixCols__colattr m={'type'}>
                        {' ('}
                        {col.get('type')}
                        {')'}
                      </MatrixCols__colattr>
                    </MatrixCols__col>
                  );
              })
            }
          </MatrixCols>
          <MatrixItems>
            {
              model.items.map(function(item, n) {
                return (
                  <MatrixItems__item key={n}>
                    <MatrixItems__itemattr m={'label'}>
                      {item.getValue('label')}
                    </MatrixItems__itemattr>
                    {
                      model.cols.map(function(col, nn) {
                        return (
                            <MatrixCols__col>
                              {'🔘Yes  🔘No'}
                            </MatrixCols__col>
                          );
                      })
                    }
                  </MatrixItems__item>
                  );
              })
            }
          </MatrixItems>
        </Matrix>
      )
  }
});

