// 📘 generated from ./model.inputParser.civet 

var _, cloneDeep, $aliases, $configs, formBuilderUtils; var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
_ = require('underscore')
cloneDeep = require('lodash.clonedeep')
$aliases = require('./model.aliases')
$configs = require('./model.configs')
formBuilderUtils = require('#/components/formBuilder/formBuilderUtils')

module.exports = (function() {
  var inputParser, hasBeenParsed, flatten_translated_fields, parseArr, normalizeRequiredValues
  inputParser = {}

  class ParsedStruct {
    constructor(type1, atts={}){
      this.type = type1
      this.atts = atts
      this.contents = []
    }
    push(item){
      this.contents.push(item)
      return
    }
    export() {
      var arr, item
      arr = []
      for (let ref = this.contents, i1 = 0, len = ref.length; i1 < len; i1++) {
 item = ref[i1]
        if (item instanceof ParsedStruct) {
          item = item.export()
        }
        arr.push(item)
      }
      return _.extend({}, this.atts, {type: this.type, __rows: arr})
    }
  }

  hasBeenParsed = function(obj){
    var row
    for (let i2 = 0, len1 = obj.length; i2 < len1; i2++) {
 row = obj[i2]
      if (row.__rows) {
        return true
      } else if ($aliases.q.testGroupable(row.type)) {
        return false
      }
    }
    return true
  }
  inputParser.hasBeenParsed = hasBeenParsed

  flatten_translated_fields = function(item, translations){
    var key, val
    for (key in item) {
 val = item[key]
      if (_.isArray(val) && key !== 'tags') {
        delete item[key]
        _.map(translations, function(_t, i){
          var _translated_val, lang_str
          _translated_val = val[i]
          if (_t) {
            lang_str = `${key}::${_t}`
          } else {
            lang_str = key
          }
          item[lang_str] = _translated_val
          return
        },
        )
      }
    }
    return item
  }

  parseArr = function(type='survey', sArr, translations=false){
    var counts, count_att, grpStack, _pushGrp, _popGrp, _curGrp, item, _groupAtts
    counts = {
      open: {},
      close: {},
    }
    count_att = function(opn_cls, att){
      counts[opn_cls][att]??=0
      counts[opn_cls][att]++
      return
    }

    grpStack = [new ParsedStruct(type)]

    _pushGrp = function(type='group', item){
      var grp
      count_att('open', type)
      grp = new ParsedStruct(type, item)
      _curGrp().push(grp)
      grpStack.push(grp)
      return
    }

    _popGrp = function(closedByAtts, type){
      var _grp
      count_att('close', type)
      _grp = grpStack.pop()
      if (_grp.type !== closedByAtts.type) {
        throw new Error('mismatched group/repeat tags')
      }
      return
    }

    _curGrp = function() {
      var _l
      _l = grpStack.length
      if (_l === 0) {
        throw new Error('unmatched group/repeat')
      }
      return grpStack[_l-1]
    }

    for (let i3 = 0, len2 = sArr.length; i3 < len2; i3++) {
 item = sArr[i3]
      _groupAtts = $aliases.q.testGroupable(item.type)

      if (translations && translations.length > 0) {
        item = flatten_translated_fields(item, translations)
      }

      if (_groupAtts) {
        if (_groupAtts.begin) {
          _pushGrp(_groupAtts.type, item)
        } else {
          _popGrp(_groupAtts, item.type)
        }
      } else {
        _curGrp().push(item)
      }
    }

    if (grpStack.length !== 1) {
      throw new Error(JSON.stringify({
          message: 'unclosed groupable set',
          counts: counts,
        }))
    }

    return _curGrp().export().__rows
  }

  // normalizes required value - truthy values become `true` and falsy values become `false`
  normalizeRequiredValues = function(survey) {
    var normalizedSurvey, row
    normalizedSurvey = cloneDeep(survey)
    for (let i4 = 0, len3 = normalizedSurvey.length; i4 < len3; i4++) {
 row = normalizedSurvey[i4]
      if (indexOf.call($configs.truthyValues, row.required) >= 0) {
        row.required = true
      } else if (indexOf.call($configs.falsyValues, row.required) >= 0 || indexOf.call([undefined, ''], row.required) >= 0) {
        row.required = false
      }
    }
    return normalizedSurvey
  }

  inputParser.parseArr = parseArr

  // pass baseSurvey whenever you import other asset into existing form
  inputParser.parse = function(o, baseSurvey){
    var translations, nullified
    translations = o.translations

    nullified = formBuilderUtils.nullifyTranslations(o.translations, o.translated, o.survey, baseSurvey)

    // we edit the received object directly, which is totally a case of BAD CODE™
    // but in fact is a necessary part of the nullify hack
    o.survey = nullified.survey
    o.translations = nullified.translations
    o.translations_0 = nullified.translations_0

    if (o.survey) {
      o.survey = normalizeRequiredValues(o.survey)
    }

    // sorts groups and repeats into groups and repeats (recreates the structure)
    if (o.survey) {
      o.survey = parseArr('survey', o.survey, o.translations)
    }

    if (o.choices) {
      o.choices = parseArr('choices', o.choices, o.translations)
    }

    // settings is sometimes packaged as an array length=1
    if (o.settings && _.isArray(o.settings) && o.settings.length === 1) {
      o.settings = o.settings[0]
    }

    return o
  }

  inputParser.loadChoiceLists = function(passedChoices, choices){
    var tmp, choiceNames, choiceRow, lName, cn
    tmp = {}
    choiceNames = []
    for (let i5 = 0, len4 = passedChoices.length; i5 < len4; i5++) {
 choiceRow = passedChoices[i5]
      lName = choiceRow['list name'] || choiceRow['list_name']
      if (!tmp[lName]) {
        tmp[lName] = []
        choiceNames.push(lName)
      }
      tmp[lName].push(choiceRow)
    }
    for (let i6 = 0, len5 = choiceNames.length; i6 < len5; i6++) {
 cn = choiceNames[i6]
      choices.add({name: cn, options: tmp[cn]})
    }
    return choices
  }

  // groupByVisibility = (inp, hidden=[], remain=[])->
  //   hiddenTypes = $aliases.q.hiddenTypes()
  //   throw Error("inputParser.sortByVisibility requires an array")  unless _.isArray(inp)
  //   for row in inp
  //     dest = if row.type? in hiddenTypes then hidden else remain
  //   [hidden, inp]

  // inputParser.sortByVisibility = sortByVisibility
  return inputParser
})()
