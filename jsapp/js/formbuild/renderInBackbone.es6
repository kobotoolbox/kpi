import React from 'react';
import ReactDOM from 'react-dom';
import KoboMatrix from './containers/KoboMatrix';
import { fromJS } from 'immutable';


/*
Initially, this KoboMatrixRow class will be an intermediary between
the react interface and the backbone `model.row` code.
*/
class KoboMatrixRow {
  constructor (model) {
    this._original = model;
    this._listDetails = {};

    let obj2 = {};
    const _o = this._original;
    obj2.label = _o.getValue('label');
    obj2.items = _o.items.options.map(( item ) => {
      const { $kuid } = item.attributes;
      obj2[$kuid] = item.attributes;
      return $kuid;
    });
    obj2.cols = _o._kobomatrix_cols().map(( item ) => {
      const _type = item.get('type').get('typeId');
      const attrs = Object.assign(item.toJSON(), {
        type: _type,
      });
      const { $kuid } = attrs;
      obj2[$kuid] = attrs;
      return $kuid;
    });
    this._data = fromJS(obj2);
  }
  get (key) {
    return this._data.get(key);
  }
  getListDetails (kuid) {
    if (!this._listDetails[kuid]) {
      let listKuid = this._data.getIn(['lists', kuid]);
      this._listDetails[kuid] = [
        {
          list_name: 'yes_no',
          name: 'yes',
          label: 'Yes',
        },
        {
          list_name: 'yes_no',
          name: 'no',
          label: 'No',
        }
      ];
      /*
      this._listDetails[kuid] = this._data.get(listKuid).map(( kuid )=> {
        return this._data.get(kuid);
      }).toJS();
      */
    }
    return this._listDetails[kuid];
  }
}

export function renderKobomatrix (view, el) {
  let model = new KoboMatrixRow(view.model);
  ReactDOM.render(<KoboMatrix model={model} />, el.get(0));
}
