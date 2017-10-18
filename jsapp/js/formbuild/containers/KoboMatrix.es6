import React from 'react';
import autoBind from 'react-autobind';
import { bemComponents } from 'js/libs/reactBemComponents';
import { t } from '../../utils';
import { sluggify, txtid } from '../../../xlform/src/model.utils';
import { Map } from 'immutable';
import Select from 'react-select';
import alertify from 'alertifyjs';

const bem = bemComponents({
  Matrix: 'kobomatrix',
  MatrixCols: 'matrix-cols',
  MatrixCols__col: 'matrix-cols__col',
  MatrixCols__settings: 'matrix-cols__settings',
  MatrixCols__settings_inner: 'matrix-cols__settings_inner',
  MatrixCols__colattr: ['matrix-cols__colattr', '<span>'],
  MatrixItems: ['matrix-items', '<ul>'],
  MatrixItemsNewCol: ['matrix-items-new'],
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
      kobomatrix_list: props.model.kobomatrix_list,
      expandedColKuid: false,
      typeChoices: [
        {
          value: 'select_one',
          label: t('Select One')
        },
        {
          value: 'select_many',
          label: t('Select Many')
        },
        {
          value: 'text',
          label: t('Text')
        },
        {
          value: 'integer',
          label: t('Number')
        },
      ]
    };
    autoBind(this);
  }

  componentDidMount() {
    const data = this.state.data;
    const kuid = this.state.kuid;
    localStorage.setItem(`koboMatrix.${kuid}`, JSON.stringify(data.toJS()));
  }

  colPopup (colKuid) {
    if (this.state.expandedColKuid === colKuid )
      this.setState({expandedColKuid: false});
    else
      this.setState({expandedColKuid: colKuid});
  }

  autoName(val) {
    var names = [];
    const kobomatrix_list = this.state.kobomatrix_list;
    var data = this.state.data;
    data.get('choices').forEach(function(ch){
      if (ch.get('list_name') == kobomatrix_list)
        names.push(ch.get('$autovalue'));
    });

    data.get('cols').forEach(function(ch){
      const col = data.get(ch);
      names.push(col.get('$autoname'));
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

  colChange(e) {
    const colKuid = this.state.expandedColKuid;
    var data = this.state.data;
    if (e.target) {
      var type = e.target.getAttribute('data-type');
      data = data.setIn([colKuid, type], e.target.value);
    } else {
      data = data.setIn([colKuid, 'type'], e.value);
      if (!['select_one', 'select_many'].includes(e.value)) {
        data = data.deleteIn([colKuid, 'select_from_list_name']);
      } else {
        data = data.setIn([colKuid, 'select_from_list_name'], 'yn'); // TODO: allow multiple choice lists
      }
    }
    this.setState({data: data});
    this.toLocalStorage(data);
  }

  getCol(colKuid, field) {
    return this.state.data.getIn([colKuid, field]);
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

  newColumn() {
    var data = this.state.data;
    const newColKuid = txtid();
    const newCol = Map({
      $autoname: this.autoName(t('Column')),
      $kuid: newColKuid,
      appearance: "w1",
      constraint: "",
      constraint_message: "",
      default: "",
      hint: "",
      label: t('Column'),
      name: this.autoName(t('Column')),
      relevant: "",
      required: "false",
      type: "text",
    });

    data = data.set(newColKuid, newCol);
    data = data.update('cols', list => list.push(newColKuid));
    this.setState({data: data});
    this.toLocalStorage(data);    
  }

  deleteRow(e) {
    const rowKuid = e.target.getAttribute('data-kuid');
    var data = this.state.data.deleteIn(['choices', rowKuid]);
    this.setState({data: data});
    this.toLocalStorage(data);    
  }

  deleteColumn(e) {
    const colKuid = this.state.expandedColKuid;
    var data = this.state.data;
    var _this = this;
    // const rowKuid = e.target.getAttribute('data-kuid');
    // var data = this.state.data.deleteIn(['choices', rowKuid]);
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Delete column'),
      message: t('Are you sure you want to delete this column? This action cannot be undone.'),
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: (evt, val) => {
        data = data.update('cols', cols => cols.filterNot(x => x === colKuid));
        _this.setState({data: data, expandedColKuid: false});
        _this.toLocalStorage(data);    
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
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
          choices = data.get('choices'),
          expandedCol = this.state.expandedColKuid;
    var _this = this;

    var items = this.getListDetails(this.state.kobomatrix_list);

    return (
        <bem.Matrix>
          <bem.MatrixCols m={'header'}>
            <bem.MatrixCols__col m={'label'} key={'label'}></bem.MatrixCols__col>
            {
              cols.map(function(colKuid, n) {
                let col = data.get(colKuid);
                return (
                    <bem.MatrixCols__col key={n} m={'header'}
                      className={expandedCol === colKuid ? 'active' : ''}>
                      <bem.MatrixCols__colattr m={'label'}>
                        {col.get('label')}
                      </bem.MatrixCols__colattr>
                      <bem.MatrixCols__colattr m={'type'}>
                        {col.get('type')}
                      </bem.MatrixCols__colattr>
                      <i className="k-icon-settings" onClick={_this.colPopup.bind(this, colKuid)}/>
                    </bem.MatrixCols__col>
                  );
              })
            }
          </bem.MatrixCols>
          <bem.MatrixCols__settings className={expandedCol ? 'expanded' : ''}>
            { expandedCol &&
              <bem.MatrixCols__settings_inner>
                <label>
                  <span>{t('Response Type')}</span>
                  <Select value={this.getCol(expandedCol, 'type')}
                    clearable={false}
                    options={this.state.typeChoices}
                    onChange={this.colChange}></Select>
                </label>
                <label>
                  <span>{t('Label')}</span>
                  <input type="text" value={this.getCol(expandedCol, 'label')}
                     onChange={this.colChange} 
                     className="js-cancel-sort"
                     data-type='label' />
                </label>
                <label>
                  <span>{t('Data Column Name')}</span>
                  <input type="text" value={this.getCol(expandedCol, 'name')}
                     onChange={this.colChange} 
                     className="js-cancel-sort"
                     data-type='name' />
                </label>
                <label className="delete">
                  <i className="k-icon-trash" onClick={_this.deleteColumn} />
                </label>
              </bem.MatrixCols__settings_inner>
            }
          </bem.MatrixCols__settings>
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
                      <i className="k-icon-trash" onClick={_this.deleteRow} data-kuid={item.$kuid} />
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
          <bem.MatrixItemsNewCol>
            <i className="k-icon-plus" onClick={this.newColumn} />
          </bem.MatrixItemsNewCol>
        </bem.Matrix>
      )
  }
}

export default KoboMatrix;