// 📘 generated from ./model.surveyFragment.civet 

var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
import _                  from 'underscore'
import Backbone           from 'backbone'
import $base              from './model.base'
import $row               from './model.row'
import $aliases           from './model.aliases'
import $utils             from './model.utils'
import $configs           from './model.configs'
import $surveyDetail      from './model.surveyDetail'
import $skipLogicHelpers  from './mv.skipLogicHelpers'
import { txtid }          from '#/utils'

class KobomatrixRow extends Backbone.Model {
  _isSelectQuestion() { return false }
}

class KobomatrixRows extends Backbone.Collection {
  model = KobomatrixRow
}

class KobomatrixMixin {
  constructor(rr){
    var extend_to_row, _begin_kuid, _end_json, _toJSON, subrow
    this._kobomatrix_columns = new KobomatrixRows()
    this._rowAttributeName = '_kobomatrix_columns'

    extend_to_row = (val, key) => {
      if (_.isFunction(val)) {
        return rr[key] = function(...args){
          return val.apply(rr, args)
        }
      } else {
        return rr[key] = val
      }
    }
    _.each(this, extend_to_row)
    extend_to_row(this.forEachRow, 'forEachRow')

    _begin_kuid = rr.getValue('$kuid', false)
    _end_json = {
      'type': `end_${this._beginEndKey()}`,
      '$kuid': `/${_begin_kuid}`,
    }
    rr._afterIterator = function(cb, ctxt){
      var obj
      obj = {
        export_relevant_values: function(surv, addl){
          surv.push(_.extend({}, _end_json))
          return
        },
        toJSON: function() {
          return _.extend({}, _end_json)
        },
      }
      if (ctxt.includeGroupEnds) {
        return cb(obj)
      } return
    }

    _toJSON = rr.toJSON

    // We don't allow cloning of matrix rows. This function would log an error if ever called by mistake
    rr.clone = function(){
      console.error('clone kobomatrix rows')
      return
    }

    rr.toJSON = function(){
      return _.extend(_toJSON.call(rr), {
        'type': `begin_${rr._beginEndKey()}`,
      }, this._additionalJson?.())
    }

    _.each(this.constructor.prototype, extend_to_row)

    if (rr.attributes.__rows) {
      for (let ref = rr.attributes.__rows, i = 0, len = ref.length; i < len; i++) {
 subrow = ref[i]
        this[this._rowAttributeName].add(subrow)
      }
      delete rr.attributes.__rows
    }
  }


  _kobomatrix_cols() {
    return this.rows
  }

  _isSelectQuestion() { return false }
  get_type() { return $skipLogicHelpers.question_types['default'] }
  _beginEndKey() {
    return 'kobomatrix'
  }

  linkUp(ctx){
    var items, kobomatrix_list
    this.getList = () => this.items
    items = {}
    kobomatrix_list = this.get('kobo--matrix_list')?.get('value')

    if (kobomatrix_list) {
      items[kobomatrix_list] = this.getSurvey().choices.get(kobomatrix_list)
    } else {
      kobomatrix_list = this.set('kobo--matrix_list', `matrix_${txtid()}`)
      items[kobomatrix_list] = this.getSurvey().choices.create()
    }

    this.rows.each((row) => {
      var listName
      if (listName = row.get('select_from_list_name')?.get('value')) {
        items[listName] = this.getSurvey().choices.get(listName)
      }
      return
    })

    this.items = items
    return this.items
  }
}


const passFunctionToMetaModel = function(obj, fname){
  obj[`__${fname}`] = obj[fname]
  obj[fname] = function(...args) { return obj._meta[fname].apply(obj._meta, args) }
  return
}

const _forEachRow = function(cb, ctx){
  if ('_beforeIterator' in this) { this._beforeIterator(cb, ctx) }
  if (!('includeErrors' in ctx)) {
    ctx.includeErrors = false
  }
  this.rows.each(function(r, index, list){
    if (typeof r.forEachRow === 'function') {
      if (ctx.includeGroups) {
        cb(r)
      }
      if (!ctx.flat) {
        r.forEachRow(cb, ctx)
      }
    } else if (r.isError()) {
      if (ctx.includeErrors) { cb(r) }
    } else {
      cb(r)
    }
    return
  })
  if ('_afterIterator' in this) { this._afterIterator(cb, ctx) }
  return
}

// This is an extended Backbone.Collection (because $base.BaseCollection extends Backbone.Collection)
class SurveyFragment extends $base.BaseCollection {
  constructor(arg, opts){
    super(arg, opts)
    this.rows = new Rows([], {_parent: this})
    this._meta = new Backbone.Model()
    passFunctionToMetaModel(this, 'set')
    passFunctionToMetaModel(this, 'get')
    passFunctionToMetaModel(this, 'on')
    passFunctionToMetaModel(this, 'off')
    passFunctionToMetaModel(this, 'trigger')
  }
  _validate() {
    var isValid
    this.clearErrors()
    isValid = true
    if (!this.settings.get('form_id')) {
      this.addError('form id must not be empty')
      isValid = false
    }

    if (!this.settings.get('form_title')) {
      this.addError('form title must not be empty')
      isValid = false
    }

    return isValid
  }
  clearErrors() {
    this.errors = []
    return
  }
  addError(message) {
    this.errors.push(message)
    return
  }
  linkUp(ctx){ return this.invoke('linkUp', ctx) }
  forEachRow(cb, ctx={}){
    _forEachRow.apply(this, [cb, ctx])
    return
  }
  getRowDescriptors() {
    var descriptors
    descriptors = []
    this.forEachRow(function(row) {
      var descriptor
      descriptor = {
        label: row.getValue('label'),
        name: row.getValue('name'),
      }
      descriptors.push(descriptor)
      return
    })
    return descriptors
  }
  findRowByCid(cid, options={}){
    var match, fn
    match = false
    fn = function(row){
      if (row.cid === cid) {
        match = row
        return match
      }
      // maybe implement a way to bust out
      // of this loop with false response.
      return !match
    }
    this.forEachRow(fn, options)
    return match
  }

  findRowByName(name, opts){
    var match
    match = false
    this.forEachRow(function(row){
      if ((row.getValue('name') || $utils.sluggifyLabel(row.getValue('label'))) === name) {
        match = row
        return match
      }
      // maybe implement a way to bust out
      // of this loop with false response.
      return !match
    },
    opts)
    return match
  }
  addRowAtIndex(r, index){ return this.addRow(r, {at: index}) }

  addRow(r, opts={}){
    
    
    
    var afterRow, index, beforeRow
    // The row we want to add needs to be added in some parent at some index.
    // Here, using the provided parent, we find index for new row. We base it on the given after or before (row).
    // Fallback is using root list of rows as parent (with no index - TODO come up with explanation why and what)
    if (afterRow = opts.after) {
      delete opts.after
      opts._parent = afterRow._parent
      index = 1 + opts._parent.models.indexOf(afterRow)
      opts.at = index
    } else if (beforeRow = opts.before) {
      delete opts.before
      opts._parent = beforeRow._parent
      index = opts._parent.models.indexOf(beforeRow)
      opts.at = index
    } else {
      opts._parent = this.rows
    }
    return opts._parent.add(r, opts)
  }

  detach() {
    this._parent.remove(this)
    return
  }

  remove(item){
    item.detach()
    return
  }

  _addGroup(opts){
    
    var rowCids, lowest_i, addOpts, grp, par, row, row_i, first_row
    // move to surveyFrag
    opts._parent = this.rows

    if (!('type' in opts)) {
      opts.type = 'group'
    }

    if (!('__rows' in opts)) {
      opts.__rows = []
    }

    opts.__rows = [].concat.apply([], opts.__rows)

    rowCids = []
    this.forEachRow((
      function(r){
        rowCids.push(r.cid)
        return
    }
      ), {includeGroups: true, includeErrors: true})

    lowest_i = false
    for (let ref1 = opts.__rows, i1 = 0, len1 = ref1.length; i1 < len1; i1++) {
 row = ref1[i1]
      row_i = rowCids.indexOf(row.cid)
      if ((lowest_i === false) || (row_i < lowest_i)) {
        lowest_i = row_i
        first_row = row
      }
    }

    addOpts = {
      previous: first_row.precedingRow(),
      parent: first_row.parentRow(),
    }
    for (let ref2 = opts.__rows, i2 = 0, len2 = ref2.length; i2 < len2; i2++) {
 row = ref2[i2]
      row.detach({silent: true})
    }

    if (!(opts.label != null)) {
      opts.label = $configs.newGroupDetails.label.value
    }
    grp = new Group(opts)
    this.getSurvey()._insertRowInPlace(grp, addOpts)
    par = addOpts.parent || this.getSurvey().rows
    par.trigger('add', grp)
    return
  }

  _allRows() {
    
    var rows
    // move to surveyFrag
    rows = []
    this.forEachRow((function(r){ if (r.constructor.kls === 'Row') { return rows.push(r) } return }), {})
    return rows
  }

  finalize() {
    // move to surveyFrag
    this.forEachRow(((r) => r.finalize()), {includeGroups: true})
    return this
  }
}

class Group extends $row.BaseRow {
  static kls = 'Group'
  static key = 'group'
  constructor(arg={}, opts){
    var __rows, row
    __rows = arg.__rows || []
    delete arg.__rows
    if (arg.label === undefined) {
      arg.label = ''
    }
    super(arg, opts)
    this.rows = new Rows([], {_parent: this})
    if (__rows) { this.rows.add(__rows) }
    for (let i3 = 0, len3 = __rows.length; i3 < len3; i3++) {
 row = __rows[i3]
      row._parent = row.collection = this.rows
    }
  }

  _isSelectQuestion() { return false }
  get_type() { return $skipLogicHelpers.question_types['default'] }

  initialize() {
    var grpDefaults, key, typeIsRepeat, obj
    grpDefaults = $configs.newGroupDetails
    for (key in grpDefaults) {
 obj = grpDefaults[key]
      if (!this.has(key)) {
        if (typeof obj.value === 'function') {
          this.set(key, obj.value(this))
        } else {
          this.set(key, obj)
        }
      }
    }
    this.ensureKuid()
    typeIsRepeat = this.get('type') === 'repeat'
    this.set('_isRepeat', typeIsRepeat)
    this.convertAttributesToRowDetails()
    if (this.getValue('type') === 'kobomatrix') {
      return new KobomatrixMixin(this)
    } return
  }

  addRowAtIndex(row, index) {
    row._parent = this.rows
    this.rows.add(row, {at:index})
    return
  }
  _isRepeat(){
    return !!(this.get('_isRepeat')?.get('value'))
  }

  autoname() {
    var name, slgOpts, new_name
    name = this.getValue('name')
    if (indexOf.call([undefined, ''], name) >= 0) {
      slgOpts = {
        lowerCase: false,
        stripSpaces: true,
        lrstrip: true,
        incrementorPadding: 3,
        validXmlTag: true,
      }
      new_name = $utils.sluggify(this.getValue('label'), slgOpts)
      this.setDetail('name', new_name)
    }
    return
  }

  finalize() {
    this.autoname()
    return
  }

  detach(opts){
    this._parent.remove(this, opts)
    return
  }

  splitApart() {
    var startingIndex, row, n
    startingIndex = this._parent.models.indexOf(this)
    this.detach()
    for (let ref3 = this.rows.models, i4 = 0, len4 = ref3.length; i4 < len4; i4++) {
 row = ref3[n=i4]
      row._parent = this._parent
      this._parent._parent.addRowAtIndex(row, startingIndex + n)
    }
    return
  }

  _beforeIterator(cb, ctxt){
    if (ctxt.includeGroupEnds) { cb(this.groupStart()) }
    return
  }
  _afterIterator(cb, ctxt){
    if (ctxt.includeGroupEnds) { cb(this.groupEnd()) }
    return
  }

  forEachRow(cb, ctx={}){
    _forEachRow.apply(this, [cb, ctx])
    return
  }

  _groupOrRepeatKey() {
    if (this._isRepeat()) { return 'repeat' } else return 'group'
  }

  groupStart() {
    const group = this
    return {
      export_relevant_values: function(surv, shts){ return surv.push(this.toJSON()) },
      toJSON: function() {
        var out, k, val
        out = {}
        for (k in group.attributes) {
 val = group.attributes[k]
          if (k !== '_isRepeat') {
            out[k] = val.getValue()
          }
        }
        out.type = `begin_${group._groupOrRepeatKey()}`
        return out
      },
    }
  }

  groupEnd() {
    const group    = this
    const _kuid    = this.getValue('$kuid')
    const _as_json = {
      type: `end_${this._groupOrRepeatKey()}`,
      $kuid: `/${_kuid}`,
    }

    return {
      export_relevant_values: function(surv, shts){
        surv.push(_.extend({}, _as_json))
        return
      },
      toJSON: function() {
        return _.extend({}, _as_json)
      },
    }
  }
}

const INVALID_TYPES_AT_THIS_STAGE = ['begin_group', 'end_group', 'begin_repeat', 'end_repeat']

const _determineConstructorByParams = function(obj){
  var formSettingsTypes, type
  formSettingsTypes = (function() {
    var key, val
    const result = []
    for (key in $configs.defaultSurveyDetails) {
 val = $configs.defaultSurveyDetails[key]
      result.push(val.name)
    }
    return result
  })()

  type = obj?.type

  if (indexOf.call(INVALID_TYPES_AT_THIS_STAGE, type) >= 0) {
    // inputParser should have converted groups and repeats into a structure by this point
    throw new Error(`Invalid type at this stage: ${type}`)
    return
  }

  if (indexOf.call(formSettingsTypes, type) >= 0) {
    // e.g. "today"
    throw new Error(`${type} is not properly handled as a SurveyDetail`)
    return $surveyDetail.SurveyDetail
  } else if (type === 'score') {
    return $row.Row
  } else if (indexOf.call(['group', 'repeat', 'kobomatrix'], type) >= 0) {
    return Group
  } else {
    return $row.Row
  }
  return
}

class Rows extends $base.BaseCollection {
  constructor(...args){
    super(...args)
    this.on('add', (a, b, c) => this._parent.getSurvey().trigger('rows-add', a, b, c))
    this.on('remove', (a, b, c) => this._parent.getSurvey().trigger('rows-remove', a, b, c))
  }
  model(obj, ctxt){
    var RowConstructor
    RowConstructor = _determineConstructorByParams(obj)
    try {
      return new RowConstructor(obj, _.extend({}, ctxt, {_parent: ctxt.collection}))
    } catch (e) {
      // Store exceptions in with the survey
      return new $row.RowError(obj, _.extend({}, ctxt, {error: e, _parent: ctxt.collection}))
    }
  }
  comparator(m){ return m.ordinal }
}

export {
  SurveyFragment,
  Group,
  Rows,
}

export default {
  SurveyFragment,
  Group,
  Rows,
}
