_ = require 'underscore'
$aliases = require './model.aliases'

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

  inputParser.parseArr = parseArr

  # pass baseSurvey whenever you import other asset into existing form
  inputParser.parse = (o, baseSurvey)->
    translations = o.translations
    if translations
      if translations.length > 1 and translations.indexOf(null) isnt -1
        throw new Error("There is an unnamed translation in your form definition. Please give a name to all translations in your form.")

      ###
      TRANSLATIONS HACK (Part 1/2):
      all the coffee code assumes first language to be null, and we don't want
      to introduce potential code-breaking refactor in old code, so we store
      first language, then replace with null and reverse this just before saving
      NOTE: when importing assets from Library into form, we need to make sure
      the default language is the same (or force baseSurve default language)
      ###
      if baseSurvey
        formDefaultLang = baseSurvey._initialParams.translations_0
        translatedProp = o.translated[0]
        # case 1: nothing to do - same default language in both
        if translations[0] is formDefaultLang
        # case 2: imported asset has form default language but not as first, so
        # we need to reorder things
        else if o.translations.includes(formDefaultLang)
          defaultLangIndex = o.translations.indexOf(formDefaultLang)
          translations.unshift(translations.pop(defaultLangIndex))
          for row in o.survey
            transletedPropArr = row[translatedProp]
            if transletedPropArr
              transletedPropArr.unshift(transletedPropArr.pop(defaultLangIndex))
        # case 3: imported assed doesn't have form default language, so we
        # add it as first and we force it onto the asset as the first language
        # and duplicate first language property as default language property
        if translations[0] isnt formDefaultLang
          translations.unshift(formDefaultLang)
          for row in o.survey
            if row[translatedProp]
              row[translatedProp].unshift(row[translatedProp][0])

      o.translations_0 = translations[0]
      translations[0] = null
    else
      translations = [null]

    # sorts groups and repeats into groups and repeats (recreates the structure)
    if o.survey
      o.survey = parseArr('survey', o.survey, translations)

    if o.choices
      o.choices = parseArr('choices', o.choices, translations)

    # settings is sometimes packaged as an array length=1
    if o.settings and _.isArray(o.settings) and o.settings.length is 1
      o.settings = o.settings[0]

    o.translations = translations

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
