import alertify from 'alertifyjs'
import { List, Map, type OrderedMap } from 'immutable'
import orderBy from 'lodash.orderby'
import React from 'react'
import autoBind from 'react-autobind'
import Select from 'react-select'
import Checkbox from '#/components/common/checkbox'
import type { AnyRowTypeName } from '#/constants'
import type { LabelValuePair, SurveyChoice } from '#/dataInterface'
import { bemComponents } from '#/libs/reactBemComponents'
import { txtid } from '#/utils'
import { sluggify } from '../../../xlform/src/model.utils'

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
  MatrixItems__itemrow: ['matrix-items__itemrow'],
  MatrixItems__itemattr: ['matrix-items__itemattr', '<span>'],
  MatrixItems__itemsettings: ['matrix-items__itemsettings'],
  MatrixButton: ['kobomatrix-button', '<button>'],
})

interface KoboMatrixProps {
  model: {
    data: KoboMatrixData
    kuid: string
    kobomatrix_list: string
  }
}

type KoboMatrixDataRow = Map<string, string> & KoboMatrixDataRowObject

interface KoboMatrixDataRowObject {
  default: string
  appearance: string
  constraint_message: string
  hint: string
  $kuid: string
  name: string
  guidance_hint: string
  label: string
  tags: string
  $xpath: string
  type: AnyRowTypeName
  constraint: string
  relevant: string
  $autoname: string
}

// This is very much linked to `SurveyChoice`, but am not sure if this is 1-1 identical piece of data. For sure `order`
// is being added internally in `KoboMatrix`.
type KoboMatrixDataChoice = Map<string, string> &
  SurveyChoice & {
    /** `order` ensures that rows are being rendered in the order they were added */
    order?: number
  }

/**
 * Note `choices` contain both matrix rows and options for select_x responses in matrix cells.
 */
type KoboMatrixDataChoicesList = OrderedMap<string, KoboMatrixDataChoice>

type KoboMatrixData = Map<string, string | KoboMatrixDataRow | List<string> | KoboMatrixDataChoicesList>

interface KoboMatrixState {
  data: KoboMatrixData
  kuid: string
  kobomatrix_list: string
  expandedColKuid: false | string
  expandedRowKuid: false | string
  typeChoices: Array<LabelValuePair>
}

class KoboMatrix extends React.Component<KoboMatrixProps, KoboMatrixState> {
  _listDetails: {}
  typingTimer?: number

  constructor(props: KoboMatrixProps) {
    super(props)
    this._listDetails = {}

    this.state = {
      data: props.model.data,
      kuid: props.model.kuid,
      kobomatrix_list: props.model.kobomatrix_list,
      expandedColKuid: false,
      expandedRowKuid: false,
      typeChoices: [
        {
          value: 'select_one',
          label: t('Select One'),
        },
        {
          value: 'select_many',
          label: t('Select Many'),
        },
        {
          value: 'text',
          label: t('Text'),
        },
        {
          value: 'integer',
          label: t('Number'),
        },
      ],
    }
    autoBind(this)
  }

  componentDidMount() {
    const data = this.state.data
    const kuid = this.state.kuid
    localStorage.setItem(`koboMatrix.${kuid}`, JSON.stringify(data.toJS()))

    // generate cols/rows for a new matrix
    const cols = data.get('cols')
    const colsSize = typeof cols === 'object' && 'size' in cols ? cols.size : -1
    const choices = data.get('choices')
    const choicesSize = typeof choices === 'object' && 'size' in choices ? choices.size : -1
    if (colsSize < 1 && choicesSize < 1) {
      this.generateDefault()
    }
  }

  /**
   * Fills up component with initial data, i.e. when user creats new matrix, it already has 2 columns and 1 choice.
   */
  generateDefault() {
    // TODO: find a better way to do this
    // See: https://github.com/kobotoolbox/kpi/issues/3924
    this.newColumn()
    window.setTimeout(() => {
      this.newColumn()
      window.setTimeout(() => {
        this.newChoiceOption(false)
      }, 500)
    }, 500)
  }

  /**
   * Opens and closes settings for given column. Only one can be visible at the same time.
   */
  toggleColumnSettings(colKuid: string) {
    if (this.state.expandedColKuid === colKuid) {
      this.setState({ expandedColKuid: false })
    } else {
      this.setState({ expandedColKuid: colKuid, expandedRowKuid: false })
    }
  }

  /**
   * Opens and closes settings for given row. Only one can be visible at the same time.
   */
  toggleRowSettings(rowKuid: string) {
    if (this.state.expandedRowKuid === rowKuid) {
      this.setState({ expandedRowKuid: false })
    } else {
      this.setState({ expandedRowKuid: rowKuid, expandedColKuid: false })
    }
  }

  /**
   * Generates a unique name
   *
   * @param {string} val
   * @param {string | false} type
   * @param {string | null } [ln]
   */
  autoName(val: string, type: string | false, ln?: string | null) {
    var names: string[] = []
    var data = this.state.data

    const cols = data.get('cols') as List<string>
    const choices = data.get('choices') as unknown as KoboMatrixDataChoicesList

    if (type === 'column') {
      cols.forEach((ch) => {
        names.push(data.getIn([ch, '$autoname']))
      })
    } else {
      choices.forEach((ch) => {
        if (ch && ch.get('list_name') === ln) {
          names.push(ch.get('$autovalue'))
        }
      })
    }

    return sluggify(val, {
      preventDuplicates: names,
      lowerCase: true,
      lrstrip: true,
      preventDuplicateUnderscores: true,
      characterLimit: 40,
      incrementorPadding: false,
      validXmlTag: false,
      replaceNonWordCharacters: true,
    })
  }

  /**
   * Handles both label and name changes for rows.
   *
   * Here we save the input raw value, and it will be fixed either after some
   * short time not typing, or when blur happens.
   *
   * @param {string} type
   * @param {Event} evt
   */
  onRowChange(type: string, evt: React.ChangeEvent<HTMLInputElement>) {
    const rowKuid = this.state.expandedRowKuid
    const val = evt.target.value

    this.setRow(this.state.expandedRowKuid, type, val)
    clearTimeout(this.typingTimer)
    this.typingTimer = window.setTimeout(this.setRow.bind(this, rowKuid, type, val, true), 1500)
  }

  /**
   * Updates or adds row in data
   *
   * @param {string} rowKuid - sometimes `false` is being passed. Why? :)
   * @param {string} type
   * @param {string} value
   * @param {boolean} [applyAutoName=false]
   */
  setRow(rowKuid: string | false, type: string, value: string, applyAutoName = false) {
    var data = this.state.data
    let newValue = value

    if (type === 'label') {
      data = data.setIn(['choices', rowKuid, type], value)
    }

    if (type === 'name') {
      if (applyAutoName) {
        newValue = this.autoName(newValue, false, this.state.kobomatrix_list)
      }
      data = data.setIn(['choices', rowKuid, 'name'], newValue)
      data = data.setIn(['choices', rowKuid, '$autovalue'], newValue)
    }

    this.setState({ data: data })
    this.toLocalStorage(data)
  }

  /**
   * Handles both label and name changes for columns - input change.
   *
   * Here we save the input raw value, and it will be fixed either after some
   * short time not typing, or when blur happens.
   *
   * @param {string} type
   * @param {Event} evt
   */
  onColumnChange(type: string, evt: React.ChangeEvent<HTMLInputElement>) {
    const colKuid = this.state.expandedColKuid
    const val = evt.target.value

    this.setColumn(colKuid, type, val)
    clearTimeout(this.typingTimer)
    this.typingTimer = window.setTimeout(this.setColumn.bind(this, colKuid, type, val, true), 1500)
  }

  /**
   * Handles both label and name changes for columns - input blur.
   *
   * Here we save a cleaned up value.
   * @param {string} type
   * @param {Event} evt
   */
  onColumnBlur(type: string, evt: React.FocusEvent<HTMLInputElement>) {
    this.setColumn(this.state.expandedColKuid, type, evt.target.value, true)
    clearTimeout(this.typingTimer)
  }

  /**
   * Updates or adds column in data
   *
   * @param {string} colKuid - sometimes `false` is being passed. Why? :)
   * @param {string} type
   * @param {string} value
   * @param {boolean} [applyAutoName=false]
   */
  setColumn(colKuid: string | false, type: string, value: string, applyAutoName = false) {
    let data = this.state.data
    let newValue = value

    if (applyAutoName && type === 'name') {
      newValue = this.autoName(newValue, 'column')
    }

    data = data.setIn([colKuid, type], newValue)

    this.setState({ data: data })
    this.toLocalStorage(data)
  }

  /**
   * Handles required checkbox setting
   */
  requiredChange(isChecked: boolean) {
    const colKuid = this.state.expandedColKuid
    var data = this.state.data
    data = data.setIn([colKuid, 'required'], isChecked)
    this.setState({ data: data })
    this.toLocalStorage(data)
  }

  /**
   * Handles changing of column type
   */
  colChangeType(e: null | { value: string | null }) {
    const colKuid = this.state.expandedColKuid
    var data = this.state.data
    const newType = e?.value || null
    const prevType = data.getIn([colKuid, 'type'])

    // warn only if existing column type is one of (Select One, Select Many)
    // and new type is NOT one of (Select One, Select Many)
    if (
      newType !== null &&
      ['select_one', 'select_many'].includes(prevType) &&
      !['select_one', 'select_many'].includes(newType)
    ) {
      const dialog = alertify.dialog('confirm')
      const opts = {
        title: t('Change column type?'),
        message: t(
          'Are you sure you want to change the type? This action is irreversible, your existing option choices will be erased.',
        ),
        labels: { ok: t('Change type'), cancel: t('Cancel') },
        onok: () => {
          data = data.setIn([colKuid, 'type'], newType)
          data = data.deleteIn([colKuid, 'select_from_list_name'])
          this.setState({ data: data })
          this.toLocalStorage(data)
        },
        oncancel: dialog.destroy,
      }
      dialog.set(opts).show()
    } else {
      data = data.setIn([colKuid, 'type'], newType)
      const prevListName = data.getIn([colKuid, 'select_from_list_name'])
      if (newType !== null && ['select_one', 'select_many'].includes(newType) && prevListName === undefined) {
        const newListId = txtid()
        data = this._addDefaultList(data, newListId)
        data = data.setIn([colKuid, 'select_from_list_name'], newListId)
      }
      this.setState({ data: data })
      this.toLocalStorage(data)
    }
  }

  /**
   * Generates a list of (2) default choices for `select_x` matrix columns
   */
  _addDefaultList(data: KoboMatrixData, newListId: string) {
    const biggestOrder = this.getChoiceCurrentBiggestOrder()

    const choice1kuid = txtid()
    const val1 = this.autoName(t('Option 1'), false, newListId)

    const choice1 = Map({
      label: t('Option 1'),
      $autovalue: val1,
      name: val1,
      $kuid: choice1kuid,
      list_name: newListId,
      order: biggestOrder + 1,
    })
    data = data.setIn(['choices', choice1kuid], choice1)

    const val2 = this.autoName(t('Option 2'), false, newListId)
    const choice2kuid = txtid()
    const choice2 = Map({
      label: t('Option 2'),
      $autovalue: val2,
      name: val2,
      $kuid: choice2kuid,
      list_name: newListId,
      order: biggestOrder + 2,
    })
    data = data.setIn(['choices', choice2kuid], choice2)
    return data
  }

  /**
   * Handles both label and name changes of a `select_x` option
   */
  choiceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const kuid = e.target.getAttribute('data-kuid')
    const type = e.target.getAttribute('data-type')
    var data = this.state.data
    var val = e.target.value

    if (type === 'label') {
      data = data.setIn(['choices', kuid, type], val)
    }

    if (type === 'name') {
      val = this.autoName(val, false, kuid)
      data = data.setIn(['choices', kuid, 'name'], val)
      data = data.setIn(['choices', kuid, '$autovalue'], val)
    }

    this.setState({ data: data })
    this.toLocalStorage(data)
  }

  /**
   * Finds value of given property of given column
   */
  getCol(colKuid: string, field: string) {
    return this.state.data.getIn([colKuid, field])
  }

  /**
   * Finds (response) type value of given column
   */
  getSelectTypeVal(expandedCol: string) {
    const typeVal = this.getCol(expandedCol, 'type')
    return this.state.typeChoices.find((option) => option.value === typeVal)
  }

  /**
   * Finds value of given property of given column choice
   */
  getChoiceField(kuid: string, field: string) {
    return this.state.data.getIn(['choices', kuid, field])
  }

  /**
   * Finds required status value of given column
   */
  getRequiredStatus(colKuid: string) {
    const val = this.state.data.getIn([colKuid, 'required'])
    return val === true || val === 'true' ? true : false
  } /**
   * From all choices (of all lists) finds the biggest `order` number
   */
  getChoiceCurrentBiggestOrder() {
    const currentChoices = this.state.data.get('choices') as KoboMatrixDataChoicesList

    // We need to find what is the biggest order of all existing choices
    let biggestOrder = 0
    currentChoices.forEach((ch) => {
      const chOrder = ch?.get('order')
      if (chOrder && Number.parseInt(chOrder) > biggestOrder) {
        biggestOrder = Number.parseInt(chOrder)
      }
    })

    return biggestOrder
  }

  /**
   * This handles both:
   * 1. adding new "row" to KoboMatrix
   * 2. adding new option to `select_one` or `select_multiple` matrix response
   */
  newChoiceOption(e: React.MouseEvent<HTMLElement> | false) {
    let data = this.state.data
    let listName = null
    if (e && e.target) {
      const target = e.target as HTMLElement
      listName = target.getAttribute('data-list-name')
    } else {
      listName = this.state.kobomatrix_list
    }

    const val = this.autoName(t('Row'), false, listName)
    const newRowKuid = txtid()
    const newRow = Map({
      label: t('Row'),
      $autovalue: val,
      name: val,
      $kuid: newRowKuid,
      list_name: listName,
      order: this.getChoiceCurrentBiggestOrder() + 1,
    })

    data = data.setIn(['choices', newRowKuid], newRow)
    this.setState({ data: data })
    this.toLocalStorage(data)
  }

  /**
   * Adds new column
   */
  newColumn() {
    var data = this.state.data
    const newColKuid = txtid()
    const cname = this.autoName(t('Column'), 'column')
    const newCol = Map({
      $autoname: cname,
      $kuid: newColKuid,
      appearance: 'w1',
      constraint: '',
      constraint_message: '',
      default: '',
      hint: '',
      label: t('Column'),
      name: cname,
      relevant: '',
      required: 'false',
      type: 'text',
    })

    data = data.set(newColKuid, newCol)
    data = data.update('cols', (cols) => (cols as List<string>).push(newColKuid))

    this.setState({ data: data })
    this.toLocalStorage(data)
  }

  /**
   * Deletes given row with a safety confirmation
   */
  deleteRow(rowKuid: string) {
    const dialog = alertify.dialog('confirm')
    const opts = {
      title: t('Delete row?'),
      message: t('Are you sure you want to delete this row? This action cannot be undone.'),
      labels: { ok: t('Delete'), cancel: t('Cancel') },
      onok: () => {
        const data = this.state.data.deleteIn(['choices', rowKuid])
        this.setState({ data: data })
        this.toLocalStorage(data)
      },
      oncancel: dialog.destroy,
    }
    dialog.set(opts).show()
  }

  /**
   * Deletes given column with a safety confirmation
   */
  deleteColumn() {
    const colKuid = this.state.expandedColKuid
    var data = this.state.data
    const dialog = alertify.dialog('confirm')
    const opts = {
      title: t('Delete column?'),
      message: t('Are you sure you want to delete this column? This action cannot be undone.'),
      labels: { ok: t('Delete'), cancel: t('Cancel') },
      onok: () => {
        // We need to convert this back to List, as `.filterNot` is not returning a `List`. Not sure why this worked previously
        data = data.update('cols', (cols) => List((cols as List<string>).filterNot((col) => col === colKuid)))
        this.setState({ data: data, expandedColKuid: false })
        this.toLocalStorage(data)
      },
      oncancel: dialog.destroy,
    }
    dialog.set(opts).show()
  }

  /**
   * Stores matrix data in local storage. The other function (`koboMatrixParser`) that is using this storage data can be
   * found in `formBuilderUtils.js` file.
   *
   * TODO: describe in more detail what is the purpose of this storage data keeping. This is for sure connected to the
   * fact that matrix is not official XLSForm type.
   */
  toLocalStorage(data: KoboMatrixData) {
    const dataJS = data.toJS()
    localStorage.setItem(`koboMatrix.${this.state.kuid}`, JSON.stringify(dataJS))
  }

  /**
   * Returns JS array of `choices` objects for given list - sorted by `order` and `label`.
   */
  getOrderedChoicesListArray(listName: string) {
    const list = this.state.data.get('choices') as KoboMatrixDataChoicesList
    var _list: Array<KoboMatrixDataRowObject> = []

    list.forEach((item) => {
      if (item && item.get('list_name') === listName) {
        _list.push(item.toJS())
      }
    })

    return orderBy(_list, ['order', 'label'])
  }

  /**
   * Returns immutable instance of all available `choices` (from all lists) sorted by `order` and `label`.
   */
  getOrderedChoices() {
    const choices = this.state.data.get('choices') as KoboMatrixDataChoicesList

    // Sort by label and then by order
    const immutableSortByOutput = choices.sortBy((ch) => ch?.get('label') ?? '').sortBy((ch) => ch?.get('order') ?? 0)

    return immutableSortByOutput.toArray()
  }

  render() {
    const data = this.state.data
    const cols = data.get('cols') as List<string>
    const orderedChoices = this.getOrderedChoices()
    const expandedCol = this.state.expandedColKuid
    const expandedRow = this.state.expandedRowKuid

    var items = this.getOrderedChoicesListArray(this.state.kobomatrix_list)

    return (
      <bem.Matrix>
        <bem.MatrixCols m={'header'}>
          <bem.MatrixCols__col m={'label'} key={'label'} />
          {cols.map((colKuid, n) => {
            if (!colKuid) return null

            const col = data.get(colKuid) as KoboMatrixDataRow
            return (
              <bem.MatrixCols__col key={n} m={'header'} className={expandedCol === colKuid ? 'active' : ''}>
                <bem.MatrixCols__colattr m={'label'}>{col.get('label')}</bem.MatrixCols__colattr>
                <bem.MatrixCols__colattr m={'type'}>{col.get('type')}</bem.MatrixCols__colattr>
                <i className='k-icon k-icon-settings' onClick={this.toggleColumnSettings.bind(this, colKuid)} />
              </bem.MatrixCols__col>
            )
          })}
        </bem.MatrixCols>
        <bem.MatrixCols__settings className={expandedCol ? 'expanded' : ''}>
          {expandedCol && (
            <bem.MatrixCols__settings_inner>
              <label>
                <span>{t('Response Type')}</span>
                <Select
                  value={this.getSelectTypeVal(expandedCol)}
                  isClearable={false}
                  options={this.state.typeChoices}
                  onChange={this.colChangeType.bind(this)}
                  className='kobo-select'
                  classNamePrefix='kobo-select'
                  menuPlacement='auto'
                  isSearchable={false}
                />
              </label>
              <label>
                <span>{t('Label')}</span>
                <input
                  type='text'
                  value={this.getCol(expandedCol, 'label')}
                  onChange={this.onColumnChange.bind(this, 'label')}
                  onBlur={this.onColumnBlur.bind(this, 'label')}
                  className='js-cancel-sort'
                  dir='auto'
                />
              </label>
              <label>
                <span>{t('Data Column Suffix')}</span>
                <input
                  type='text'
                  value={this.getCol(expandedCol, 'name')}
                  onChange={this.onColumnChange.bind(this, 'name')}
                  onBlur={this.onColumnBlur.bind(this, 'name')}
                  className='js-cancel-sort'
                />
              </label>
              <label>
                <span>{t('Required')}</span>
                <Checkbox
                  checked={this.getRequiredStatus(expandedCol)}
                  onChange={this.requiredChange.bind(this)}
                  className='js-cancel-sort'
                />
              </label>
              {this.getCol(expandedCol, 'select_from_list_name') && (
                <div className='matrix-cols__options'>
                  <div className='matrix-cols__options--row-head'>
                    <span>{t('Label')}</span>
                    <span>{t('Data Column Name')}</span>
                  </div>
                  {orderedChoices.map((choice) => {
                    if (choice.get('list_name') === this.getCol(expandedCol, 'select_from_list_name')) {
                      const ch = choice.get('$kuid')
                      return (
                        <div className='matrix-cols__options--row' key={ch}>
                          <span>
                            <input
                              type='text'
                              value={this.getChoiceField(ch, 'label')}
                              onChange={this.choiceChange.bind(this)}
                              className='js-cancel-sort'
                              data-type='label'
                              data-kuid={ch}
                              dir='auto'
                            />
                          </span>
                          <span className='matrix-options__value'>
                            <input
                              type='text'
                              value={this.getChoiceField(ch, 'name')}
                              onChange={this.choiceChange.bind(this)}
                              className='js-cancel-sort'
                              data-type='name'
                              data-kuid={ch}
                            />
                          </span>
                          <span className='matrix-options__delete'>
                            <i className='k-icon k-icon-trash' onClick={this.deleteRow.bind(this, ch)} />
                          </span>
                        </div>
                      )
                    } else {
                      return null
                    }
                  })}
                  <div className='matrix-cols__options--row-foot'>
                    <i
                      className='k-icon k-icon-plus'
                      title={t('Add new option')}
                      onClick={this.newChoiceOption.bind(this)}
                      data-list-name={this.getCol(expandedCol, 'select_from_list_name')}
                    />
                  </div>
                </div>
              )}
              <div className='matrix-cols__delete'>
                <span className='matrix-cols__delete-action' onClick={this.deleteColumn}>
                  {t('Delete column')} <i className='k-icon k-icon-trash' />
                </span>
              </div>
            </bem.MatrixCols__settings_inner>
          )}
        </bem.MatrixCols__settings>
        <bem.MatrixItems>
          {items.map((item, n) => (
            <bem.MatrixItems__item key={n}>
              <bem.MatrixItems__itemrow>
                <bem.MatrixItems__itemattr m={'label'}>
                  <label>{item.label}</label>
                  <i className='k-icon k-icon-settings' onClick={this.toggleRowSettings.bind(this, item.$kuid)} />
                </bem.MatrixItems__itemattr>
                {cols.map((colKuid) => {
                  if (!colKuid) return null

                  const col = data.get(colKuid) as KoboMatrixDataRow
                  const _listName = col.get('select_from_list_name')
                  let _isUnderscores = false
                  let contents: string[] = []

                  if (_listName) {
                    const list = this.getOrderedChoicesListArray(_listName)
                    const listStyleChar = '🔘'
                    list.forEach((item) => {
                      contents.push(`${listStyleChar} ${item.label}`)
                    })
                  } else {
                    _isUnderscores = true
                    contents = ['_________']
                  }
                  return (
                    <bem.MatrixCols__col
                      key={colKuid}
                      m={{
                        list: !!_listName,
                        underscores: _isUnderscores,
                      }}
                    >
                      {contents.join(' ')}
                    </bem.MatrixCols__col>
                  )
                })}
              </bem.MatrixItems__itemrow>
              <bem.MatrixItems__itemsettings className={expandedRow === item.$kuid ? 'expanded' : ''}>
                {expandedRow && (
                  <bem.MatrixCols__settings_inner>
                    <label>
                      <span>{t('Label')}</span>
                      <input
                        type='text'
                        value={item.label}
                        onChange={this.onRowChange.bind(this, 'label')}
                        className='js-cancel-sort'
                        dir='auto'
                      />
                    </label>
                    <label>
                      <span>{t('Data Column Prefix')}</span>
                      <input
                        type='text'
                        value={item.name}
                        onChange={this.onRowChange.bind(this, 'name')}
                        className='js-cancel-sort'
                      />
                    </label>
                    <div className='matrix-cols__delete'>
                      <span className='matrix-cols__delete-action' onClick={this.deleteRow.bind(this, item.$kuid)}>
                        {t('Delete row')} <i className='k-icon k-icon-trash' />
                      </span>
                    </div>
                  </bem.MatrixCols__settings_inner>
                )}
              </bem.MatrixItems__itemsettings>
            </bem.MatrixItems__item>
          ))}
          <bem.MatrixItems__item key={'new'} m={'new'}>
            <i
              title={t('Add new row')}
              className='k-icon k-icon-plus'
              onClick={this.newChoiceOption.bind(this)}
              data-list-name={this.state.kobomatrix_list}
            />
          </bem.MatrixItems__item>
        </bem.MatrixItems>
        <bem.MatrixItemsNewCol>
          <i className='k-icon k-icon-plus' onClick={this.newColumn} />
        </bem.MatrixItemsNewCol>
      </bem.Matrix>
    )
  }
}

export default KoboMatrix
