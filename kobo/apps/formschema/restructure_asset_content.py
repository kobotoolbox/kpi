'''
restructure_asset_content() is a method that accepts a python object representation
of a form (as is saved in Asset.content) and makes minimal changes to make the
structure follow the schema as defined in rowschema.py and validated by
validate_content.py
'''

from jsonschema import validate
from copy import deepcopy

from .rowschema import ROWSCHEMA


def restructure_asset_content(_form):
    form = deepcopy(_form)
    translated_vals = form['translated']
    del(form['translated'])
    txs = []
    for (index, tx) in enumerate(form['translations']):
        _txobj = {'$txid': 'tx{}'.format(index)}
        _txobj['name'] = tx
        if tx is None:
            _txobj['name'] = ''
        txs.append(_txobj)
    form['translations'] = txs

    for srow in form['survey']:
        if 'select_from_list_name' in srow:
            _select_from = srow['select_from_list_name']
            del(srow['select_from_list_name'])
            srow['select_from'] = _select_from
        for field in translated_vals:
            _fobj = False
            label = srow.get(field, None)
            if label is not None:
                _fobj = {}
                if len(label) == len(txs):
                    for (index, tx) in enumerate(txs):
                        _id = tx['$txid']
                        _fobj[_id] = label[index]
                srow[field] = _fobj
        message = ''
        try:
            validate(srow, ROWSCHEMA)
        except Exception as err:
            message = '{}: {}'.format(str(err.absolute_path), str(err.args))
    if 'choices' in form:
        if isinstance(form['choices'], list):
            cx = {}
            for cxn in form['choices']:
                list_name = cxn['list_name']
                del(cxn['list_name'])
                if list_name not in cx:
                    cx[list_name] = []
                cx[list_name].append(cxn)
            form['choices'] = cx
    return form
