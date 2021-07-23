_ = require 'underscore'
cloneDeep = require('lodash.clonedeep')
$aliases = require './model.aliases'
$configs = require './model.configs'
formBuilderUtils = require '../../js/components/formBuilder/formBuilderUtils'

module.exports = do ->
  inputParser = {}

  class ParsedStruct
    constructor: (@type, @atts={})->
      @contents = []
    push: (item)->
      @contents.push(item)
      ``
    export: ->
      arr = []
      for item in @contents
        if item instanceof ParsedStruct
          item = item.export()
        arr.push(item)
      _.extend({}, @atts, {type: @type, __rows: arr})

  hasBeenParsed = (obj)->
    for row in obj
      if row.__rows
        return true
      else if $aliases.q.testGroupable(row.type)
        return false
    return true
  inputParser.hasBeenParsed = hasBeenParsed

  flatten_translated_fields = (item, translations)->
    for key, val of item
      if _.isArray(val) and key != 'tags'
        delete item[key]
        _.map(translations, (_t, i)->
          _translated_val = val[i]
          if _t
            lang_str = "#{key}::#{_t}"
          else
            lang_str = key
          item[lang_str] = _translated_val
        )
    return item

  parseArr = (type='survey', sArr, translations=false)->
    counts = {
      open: {}
      close: {}
    }
    count_att = (opn_cls, att)->
      counts[opn_cls][att]?=0
      counts[opn_cls][att]++
      ``
    grpStack = [new ParsedStruct(type)]

    _pushGrp = (type='group', item)->
      count_att('open', type)
      grp = new ParsedStruct(type, item)
      _curGrp().push(grp)
      grpStack.push(grp)

    _popGrp = (closedByAtts, type)->
      count_att('close', type)
      _grp = grpStack.pop()
      if _grp.type isnt closedByAtts.type
        throw new Error("mismatched group/repeat tags")
      ``

    _curGrp = ->
      _l = grpStack.length
      if _l is 0
        throw new Error("unmatched group/repeat")
      grpStack[_l-1]

    for item in sArr
      _groupAtts = $aliases.q.testGroupable(item.type)

      if translations and translations.length > 0
        item = flatten_translated_fields(item, translations)

      if _groupAtts
        if _groupAtts.begin
          _pushGrp(_groupAtts.type, item)
        else
          _popGrp(_groupAtts, item.type)
      else
        _curGrp().push(item)

    if grpStack.length isnt 1
      throw new Error(JSON.stringify({
          message: "unclosed groupable set",
          counts: counts
        }))

    _curGrp().export().__rows

  # normalizes required value - truthy values become `true` and falsy values become `false`
  normalizeRequiredValues = (survey) ->
    normalizedSurvey = cloneDeep(survey)
    for row in normalizedSurvey
      if row.required in $configs.truthyValues
        row.required = true
      else if row.required in $configs.falsyValues or row.required in [undefined, '']
        row.required = false
    return normalizedSurvey

  inputParser.parseArr = parseArr

  # pass baseSurvey whenever you import other asset into existing form
  inputParser.parse = (o, baseSurvey)->
    translations = o.translations

    nullified = formBuilderUtils.nullifyTranslations(o.translations, o.translated, o.survey, baseSurvey)

    # we edit the received object directly, which is totally a case of BAD CODE™
    # but in fact is a necessary part of the nullify hack
    o.survey = nullified.survey;
    o.translations = nullified.translations
    o.translations_0 = nullified.translations_0

    if o.survey
      o.survey = normalizeRequiredValues(o.survey)

    # sorts groups and repeats into groups and repeats (recreates the structure)
    if o.survey
      o.survey = parseArr('survey', o.survey, o.translations)

    if o.choices
      o.choices = parseArr('choices', o.choices, o.translations)

    # settings is sometimes packaged as an array length=1
    if o.settings and _.isArray(o.settings) and o.settings.length is 1
      o.settings = o.settings[0]

    return o

  inputParser.loadChoiceLists = (passedChoices, choices)->
    tmp = {}
    choiceNames = []
    for choiceRow in passedChoices
      lName = choiceRow["list name"] || choiceRow["list_name"]
      unless tmp[lName]
        tmp[lName] = []
        choiceNames.push(lName)
      tmp[lName].push(choiceRow)
    for cn in choiceNames
      choices.add(name: cn, options: tmp[cn])

  # groupByVisibility = (inp, hidden=[], remain=[])->
  #   hiddenTypes = $aliases.q.hiddenTypes()
  #   throw Error("inputParser.sortByVisibility requires an array")  unless _.isArray(inp)
  #   for row in inp
  #     dest = if row.type? in hiddenTypes then hidden else remain
  #   [hidden, inp]

  # inputParser.sortByVisibility = sortByVisibility
  inputParser
