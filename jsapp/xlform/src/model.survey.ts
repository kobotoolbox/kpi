// 📘 generated from ./model.survey.civet 

// FILE: model.survey

var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
var hasProp: <T>(object: T, prop: PropertyKey) => boolean = ({}.constructor as any).hasOwn
import _ from 'underscore'

// [ ] model.base
//    TODO: finish model.base
//    TODO: undo generated types
// [ ] model.choices
// [ ] model.utils
// [ ] model.configs
// [ ]

import $base              from './model.base'
import $choices           from './model.choices'
import $modelUtils        from './model.utils'
import $configs           from './model.configs'

import $surveyFragment    from './model.surveyFragment'
import $surveyDetail      from './model.surveyDetail'
import $inputDeserializer from './model.inputDeserializer'
import $inputParser       from './model.inputParser'

import $markdownTable     from './model.utils.markdownTable'
import csv                from './csv'

import { LOCKING_PROFILES_PROP_NAME } from '#/components/locking/lockingConstants'
import { txtid } from '#/utils'

// extends SurveyFragment, which extends Collection
class Survey extends $surveyFragment.SurveyFragment {
  constructor(options={}, addlOpts){
    var sname, r
    super()
    if (options.error) {
      throw new Error('instantiating survey with error parameter')
    }
    this._initialParams = options

    this.settings = new Settings(options.settings, {_parent: this})
    if (!options.settings) {
      this.settings.enable_auto_name()
    }

    if (sname = this.settings.get('name') || options.name) {
      this.set('name', sname)
    }

    /*
    // We don't use locking profiles in any way yet, so we just store it for
    // saving - for checking these out, coffee code is using raw survey JSON.
    */
    this.lockingProfiles = options[LOCKING_PROFILES_PROP_NAME]

    this.newRowDetails = options.newRowDetails || $configs.newRowDetails
    this.defaultsForType = options.defaultsForType || $configs.defaultsForType

    this.surveyDetails = new $surveyDetail.SurveyDetails([], {_parent: this}).loadSchema(options.surveyDetailsSchema || $configs.surveyDetailSchema)
    this.choices = new $choices.ChoiceLists([], {_parent: this})
    $inputParser.loadChoiceLists(options.choices || [], this.choices)

    if (options.survey) {
      if (!$inputParser.hasBeenParsed(options)) {
        options.survey = $inputParser.parseArr(options.survey)
      }
      for (let ref = options.survey, i = 0, len = ref.length; i < len; i++) {
 r = ref[i]
        if (typeof r.id !== 'undefined') {
          throw new Error(`Forbidden column \`id\` for row: ${JSON.stringify(r, null, 2)}`)
        }

        if (indexOf.call($configs.surveyDetailSchema.typeList(), r.type) >= 0) {
          this.surveyDetails.importDetail(r)
        } else {
          this.rows.add(r, {collection: this.rows, silent: true, _parent: this.rows})
        }
      }
    } else {
      this.surveyDetails.importDefaults()
    }
    this.context = {
      warnings: [],
      errors: [],
    }
    this.forEachRow((r) => {
      if (typeof r.linkUp === 'function') {
        r.linkUp(this.context)
      }
      return
    })
    this.linkUpChoiceLists()
  }

  static create(options={}, addlOpts) {
    return new Survey(options, addlOpts)
  }

  linkUpChoiceLists() {
    
    
    var choiceList, overlapping_choice_keys
    // In case of cascading selects, this will ensure choiceLists are connected to
    // sub choice lists through a private "__cascadeList" property
    const choiceKeys = this.choices.getListNames()
    for (let ref1 = this.choices.models, i1 = 0, len1 = ref1.length; i1 < len1; i1++) {
 choiceList = ref1[i1]
      overlapping_choice_keys = _.intersection(choiceKeys, choiceList.getOptionKeys(true))
      if (overlapping_choice_keys.length > 1) {
        throw new Error('cascading choices can only reference one choice list')
      } else if (overlapping_choice_keys.length === 1) {
        choiceList.__cascadedList = this.choices.get(overlapping_choice_keys[0])
      }
    }
    return
  }

  insert_row(row, index) {
    
    var rowlist, name_detail
    // TODO: why? `_isCloned` is being used only once, in `ScoreRankMixin`'s `clone` function.
    if (row._isCloned) {
      this.rows.add(row, {at: index})
    } else {
      this.rows.add(row.toJSON(), {at: index})
    }
    const new_row = this.rows.at(index)
    const survey  = this.getSurvey()
    if (rowlist = row.getList()) {
      survey.choices.add({options: rowlist.options.toJSON()})
      new_row.get('type').set('list', rowlist)
    }
    name_detail = new_row.get('name')
    return name_detail.set('value', name_detail.deduplicate(survey))
  }

  _ensure_row_list_is_copied(row) {
    var rowlist
    if (!row.rows && (rowlist = row.getList())) {
      this.choices.add({name: rowlist.get('name'), options: rowlist.options.toJSON()})
    }
    return
  }

  insertSurvey(survey, index=-1, targetGroupId){
    var row, row_i, target, index_incr, foundGroup, name_detail
    if (index === -1) { index = this.rows.length }
    for (let ref2 = survey.rows.models, i2 = 0, len2 = ref2.length; i2 < len2; i2++) {
 row = ref2[row_i=i2]
      // if target is a group, not root list of rows, we need to switch
      target = this
      if (targetGroupId) {
        foundGroup = this.findRowByCid(targetGroupId, {includeGroups: true})
        if (foundGroup) {
          target = foundGroup
        } else {
          throw new Error(`Couldn't find group ${targetGroupId}!`)
        }
      }

      index_incr = index + row_i

      // inserting a group
      if (row.rows) {
        if (row.forEachRow) {
          row.forEachRow(
            (r) => this._ensure_row_list_is_copied(r),
            {includeGroups: true},
          )
        }

        this._insertRowInPlace(
          row,
          {
            index: index_incr,
            parent: target,
            noDetach: true,
          },
        )

        // inserting a group (block from Library) doesn't trigger change event
        // anywhere else, so we do it here manually
        this.trigger('change')
      }
      // inserting a question
      else {
        this._ensure_row_list_is_copied(row)
        name_detail = row.get('name')
        name_detail.set('value', name_detail.deduplicate(this))
        target.rows.add(
          row.toJSON(),
          {at: index_incr},
        )
      }
    }
    return
  }

  toFlatJSON(stringify=false, spaces=4){
    var obj, flattened_choices, key, val, list_item, _c, row
    obj = this.toJSON()

    const results=[]; for (let ref3 = obj.survey, i3 = 0, len3 = ref3.length; i3 < len3; i3++) {
 row = ref3[i3]
      if (_.isObject(row.type)) {
        row.type = [
          _.keys(row.type)[0], _.values(row.type)[0],
        ].join(' ')
      }
      results.push(row)
    }obj.survey = results
    if (_.isObject(obj.choices)) {
      flattened_choices = []
      for (key in obj.choices) {
 if (!hasProp(obj.choices, key)) continue; val = obj.choices[key]
        for (let i4 = 0, len4 = val.length; i4 < len4; i4++) {
 list_item = val[i4]
          _c = $.extend({list_name: key}, list_item)
          delete _c.setManually
          flattened_choices.push(_c)
        }
      }
      obj.choices = flattened_choices
    }

    obj.settings = [this.settings.attributes]

    if (this.lockingProfiles) {
      obj[LOCKING_PROFILES_PROP_NAME] = this.lockingProfiles
    }

    if (stringify) {
      return JSON.stringify(obj, null, spaces)
    } else {
      return obj
    }
  }

  toJSON(stringify=false, spaces=4){
    var obj, addlSheets, shtName, sheet
    obj = {}

    addlSheets = {
      choices: new $choices.ChoiceLists(),
    }

    obj.survey = (() => {
      var out, fn, sd
      out = []
      fn = function(r){
        var l
        if ('getList' in r && (l = r.getList())) {
          addlSheets.choices.add(l)
        }

        if (typeof r.export_relevant_values === 'function') {
          r.export_relevant_values(out, addlSheets)
        } else {
          console.error('No r.export_relevant_values. Does this survey have non-standard columns?', r)
        }
        return
      }

      this.forEachRow(fn, {includeGroupEnds: true})

      for (let ref4 = this.surveyDetails.models, i5 = 0, len5 = ref4.length; i5 < len5; i5++) {
 sd = ref4[i5]; if (!sd.get('value')) continue
        out.push(sd.toJSON())
      }

      return out
    })()

    for (shtName in addlSheets) {
 sheet = addlSheets[shtName]; if (!(sheet.length > 0)) continue
      obj[shtName] = sheet.summaryObj(true)
    }

    if (stringify) {
      return JSON.stringify(obj, null, spaces)
    } else {
      return obj
    }
  }
  getSurvey() { return this }
  log(opts={}){
    var logFn, tabs, logr
    logFn = opts.log || (function(...a){ return console.log.apply(console, a) })
    tabs = ['-']
    logr = function(r){
      if ('forEachRow' in r) {
        logFn(tabs.join('').replace(/-/g, '='), r.get('label').get('value'))
        tabs.push('-')
        r.forEachRow(logr, {flat: true, includeGroups: true})
        return tabs.pop()
      } else {
        return logFn(tabs.join(''), r.get('label').get('value'))
      }
    }
    this.forEachRow(logr, {flat: true, includeGroups: true})
    return
  }

  summarize() {
    var rowCount, hasGps, fn
    rowCount = 0
    hasGps = false
    fn = function(r){
      if (r.get('type').get('value') === 'geopoint') {
        hasGps = true
      }
      rowCount++
      return
    }
    this.forEachRow(fn, {includeGroups: false})

    // summaryObj
    return {
      rowCount: rowCount,
      hasGps: hasGps,
    }
  }
  _insertRowInPlace(row, opts={}){
    var index, previous, parent
    if (row._parent && !opts.noDetach) {
      row.detach({silent: true})
    }
    index = 0
    if (opts.index) {
      index = opts.index
    }
    previous = opts.previous
    parent = opts.parent
    if (previous) {
      parent = previous.parentRow()
      index = parent.rows.indexOf(previous) + 1
    }
    if (!parent) {
      parent = this
    }
    parent.rows.add(row, {at: index})

    // line below looks like BAD CODE™ but in fact it enables row reordering
    row._parent = parent.rows

    if (opts.event) {
      parent.rows.trigger(opts.event)
    }
    return
  }

  prepCols(cols, opts={}) {
    var exclude, add, out
    exclude = opts.exclude || []
    add = opts.add || []
    if (_.isString(exclude) || _.isString(add)) {
      throw new Error('prepCols parameters should be arrays')
    }
    out = _.filter(_.uniq( _.flatten(cols)), function(col) { return indexOf.call(exclude, col) < 0 })
    return out.concat.apply(out, add)
  }

  toSsStructure(){
    var out, sheet, content
    out = {}
    for (sheet in this.toCsvJson()) {
 content = this.toCsvJson()[sheet]
      out[sheet] = content.rowObjects
    }
    return out
  }
  toCsvJson(){
    
    

    var out, choicesCsvJson
    // build an object that can be easily passed to the "csv" library
    // to generate the XL(S)Form spreadsheet

    this.finalize()

    out = {}
    out.survey = (() => {
      var oCols, oRows, addRowToORows, sd
      oCols = ['name', 'type', 'label']
      oRows = []

      addRowToORows = function(r){
        var colJson, key, val
        colJson = r.toJSON()
        for (key in colJson) {
 if (!hasProp(colJson, key)) continue; val = colJson[key]; if (!(indexOf.call(oCols, key) < 0)) continue
          oCols.push(key)
        }
        return oRows.push(colJson)
      }

      this.forEachRow(addRowToORows, {includeErrors: true, includeGroupEnds: true})
      for (let ref5 = this.surveyDetails.models, i6 = 0, len6 = ref5.length; i6 < len6; i6++) {
 sd = ref5[i6]; if (!sd.get('value')) continue
        addRowToORows(sd)
      }

      return {
        columns: oCols,
        rowObjects: oRows,
      }
    })()


    choicesCsvJson = (() => {
      var choiceList, clAtts, clName, option
      const lists = new $choices.ChoiceLists()
      this.forEachRow(function(r){
        const _getSubLists = function(item){
          var list
          if ('getList' in item) {
            list = item.getList()
            if (list && !lists.get(list.get('name'))) {
              lists.add(list)
              return _getSubLists(list)
            } return
          } return
        }
        return _getSubLists(r)
      })

      const rows = []
      const cols = []
      for (let ref6 = lists.models, i7 = 0, len7 = ref6.length; i7 < len7; i7++) {
 choiceList = ref6[i7]
        if (!choiceList.get('name')) { choiceList.set('name', txtid(), {silent: true}) }
        choiceList.finalize()
        clAtts = choiceList.toJSON()
        clName = clAtts.name
        for (let ref7 = clAtts.options, i8 = 0, len8 = ref7.length; i8 < len8; i8++) {
 option = ref7[i8]
          cols.push(_.keys(option))
          rows.push(_.extend({}, option, {'list_name': clName}))
        }
      }


      if (rows.length > 0) {
        return {
          columns: this.prepCols(cols, {exclude: ['setManually'], add: ['list_name']}),
          rowObjects: rows,
        }
      } else {
        return false
      }
    })()

    if (choicesCsvJson) { out.choices = choicesCsvJson }
    out.settings = this.settings.toCsvJson()

    return out
  }

  toMarkdown(){
    return $markdownTable.csvJsonToMarkdown(this.toCsvJson())
  }

  toCSV() {
    var sheeted, shtName, content
    sheeted = csv.sheeted()
    for (shtName in this.toCsvJson()) {
 content = this.toCsvJson()[shtName]
      sheeted.sheet(shtName, csv(content))
    }
    return sheeted.toString()
  }
}

Survey.load = function(csv_repr, _usingSurveyLoadCsv=false){
  
  var _deserialized, _parsed
  // log('switch to Survey.load.csv')  if !_usingSurveyLoadCsv
  if (_.isString(csv_repr) && !_is_csv(csv_repr)) {
    throw Error('Invalid CSV passed to form builder')
  }
  _deserialized = $inputDeserializer.deserialize(csv_repr)
  _parsed = $inputParser.parse(_deserialized)
  return new Survey(_parsed)
}

Survey.load.csv = function(csv_repr){
  return Survey.load(csv_repr, true)
}

Survey.load.md = function(md){
  var sObj
  sObj = $markdownTable.mdSurveyStructureToObject(md)
  return new Survey(sObj)
}
Survey.loadDict = function(obj, baseSurvey){
  var _parsed
  _parsed = $inputParser.parse(obj, baseSurvey)
  return new Survey(_parsed)
}

/** Checks that a string has a newline and a comma,
    a very simplistic test of a csv */
const _is_csv = function(csv_repr: string) {
  return csv_repr.indexOf('\n') >= 0 && csv_repr.indexOf(',') >= 0
}

// Settings (assigned to each $survey.Survey instance)
class Settings extends $base.BaseModel {
  validation = {}
  toCsvJson() {
    const columns    = _.keys(this.attributes)
    const rowObjects = [this.toJSON()]
    return { columns, rowObjects }
  }
  enable_auto_name() {
    this.auto_name = true

    this.on('change:form_id', () => {
      if (this.changing_form_title) {
        this.changing_form_title = false
      } else {
        this.auto_name = false
      }
      return
    })

    this.on('change:form_title', (model, value) => {
      if (this.auto_name) {
        this.changing_form_title = true
        this.set('form_id', $modelUtils.sluggifyLabel(value))
      }
      return
    })
    return
  }
}

export {
  Survey,
  Settings,
}
export default {
  Survey,
  Settings,
}
