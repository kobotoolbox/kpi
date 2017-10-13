import React from 'react';
import autoBind from 'react-autobind';
import { bemComponents } from 'js/libs/reactBemComponents';
import { t } from '../../utils';
import { sluggify, txtid } from '../../../xlform/src/model.utils';
import { Map } from 'immutable';

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
  constructor (props) {
    super(props);
    this._listDetails = {};

    this.state = {
      data: props.model.data,
      kuid: props.model.kuid,
      kobomatrix_list: props.model.kobomatrix_list
    };
    autoBind(this);
  }
  colPopup (col) {
    console.log(col.toJS());
  }
  componentDidMount() {
    const data = this.state.data;
    const kuid = this.state.kuid;
    localStorage.setItem(`koboMatrix.${kuid}`, JSON.stringify(data.toJS()));
  }

  handleChangeColLabel(e) {
    var colKuid = e.target.getAttribute('data-kuid');
    var data = this.state.data;
    data = data.setIn([colKuid, 'label'], e.target.value);
    this.setState({data: data});
    this.toLocalStorage(data);
  }

  autoName(val) {
    var names = [];
    const kobomatrix_list = this.state.kobomatrix_list;
    this.state.data.get('choices').forEach(function(ch){
      if (ch.get('list_name') == kobomatrix_list)
        names.push(ch.get('$autovalue'));
    }); 
    return sluggify(val, {
      preventDuplicates: names,
      lowerCase: true,
      lrstrip: true,
      characterLimit: 14,
      incrementorPadding: false,
      validXmlTag: false
    });
  }

  handleChangeRowLabel(e) {
    const val = e.target.value, 
          rowKuid = e.target.getAttribute('data-kuid'),
          kobomatrix_list = this.state.kobomatrix_list;
    var data = this.state.data;

    data = data.setIn(['choices', rowKuid, '$autovalue'], this.autoName(val));
    data = data.setIn(['choices', rowKuid, 'name'], this.autoName(val));
    data = data.setIn(['choices', rowKuid, 'label'], val);

    this.setState({data: data});
    this.toLocalStorage(data);
  }

  newRow() {
    var data = this.state.data;

    const newRowKuid = txtid();
    const newRow = Map({
      label: t('Option'),
      $autovalue: this.autoName(t('Option')),
      name: this.autoName(t('Option')),
      $kuid: newRowKuid,
      list_name: this.state.kobomatrix_list
    });

    data = data.setIn(['choices', newRowKuid], newRow);

    this.setState({data: data});
    this.toLocalStorage(data);
  }

  deleteRow(e) {
    const rowKuid = e.target.getAttribute('data-kuid');
    var data = this.state.data.deleteIn(['choices', rowKuid]);
    this.setState({data: data});
    this.toLocalStorage(data);    
  }

  toLocalStorage(data) {
    const dataJS = data.toJS();
    localStorage.setItem(`koboMatrix.${this.state.kuid}`, JSON.stringify(dataJS));    
  }

  getListDetails (listName) {
    const list = this.state.data.get('choices');
    var _list = [];

    list.forEach(function(item){
      if (item.get('list_name') == listName)
        _list.push(item.toJS());
    });

    return _list;
  }

  render () {
    const data = this.state.data;
    const cols = data.get('cols'),
          choices = data.get('choices');
    var _this = this;

    var items = this.getListDetails(this.state.kobomatrix_list);

    return (
        <bem.Matrix>
          <bem.MatrixCols m={'header'}>
            <bem.MatrixCols__col m={'label'} key={'label'}>
              
            </bem.MatrixCols__col>
            {
              cols.map(function(colKuid, n) {
                let col = data.get(colKuid);
                return (
                    <bem.MatrixCols__col key={n} m={'header'}>
                      <bem.MatrixCols__colattr m={'label'}>
                        <input type="text" value={col.get('label')} 
                               onChange={_this.handleChangeColLabel} 
                               id={`input-C${n}`}
                               className="js-cancel-sort"
                               data-kuid={colKuid}
                               />
                      </bem.MatrixCols__colattr>
                      <bem.MatrixCols__colattr m={'type'}>
                        {col.get('type')}
                      </bem.MatrixCols__colattr>
                      <i className="k-icon-settings" onClick={_this.colPopup.bind(this, col)}/>
                    </bem.MatrixCols__col>
                  );
              })
            }
          </bem.MatrixCols>
          <bem.MatrixItems>
            {
              items.map(function(item, n) {
                return (
                  <bem.MatrixItems__item key={n}>
                    <bem.MatrixItems__itemattr m={'label'}>
                      <input type="text" value={item.label} 
                             onChange={_this.handleChangeRowLabel} 
                             className="js-cancel-sort"
                             data-kuid={item.$kuid} />
                      <i className="k-icon-trash" onClick={_this.deleteRow} data-kuid={item.$kuid}/>
                    </bem.MatrixItems__itemattr>
                    {
                      cols.map(function(colKuid, nn) {
                        const col = data.get(colKuid),
                          _listName = col.get('select_from_list_name'),
                          _type = col.get('type');

                        let _isUnderscores = false,
                          contents = [];
                        if (_listName) {
                          let list = _this.getListDetails(_listName);
                          let listStyleChar = '🔘';
                          list.forEach(function(item){
                            contents.push(`${listStyleChar} ${item.label}`);
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
            <bem.MatrixItems__item key={'new'}>
              <bem.MatrixItems__itemattr m={'new'}>
                <i className="k-icon-plus" 
                    onClick={this.newRow}/>
              </bem.MatrixItems__itemattr>
            </bem.MatrixItems__item>
          </bem.MatrixItems>
        </bem.Matrix>
      )
  }
}

export default KoboMatrix;