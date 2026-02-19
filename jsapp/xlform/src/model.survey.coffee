_ = require 'underscore'
$base = require './model.base'
$choices = require './model.choices'
$modelUtils = require './model.utils'
$configs = require './model.configs'
$surveyFragment = require './model.surveyFragment'
$surveyDetail = require './model.surveyDetail'
$inputDeserializer = require './model.inputDeserializer'
$inputParser = require './model.inputParser'
$markdownTable = require './model.utils.markdownTable'
csv = require './csv'
LOCKING_PROFILES_PROP_NAME = require('#/components/locking/lockingConstants').LOCKING_PROFILES_PROP_NAME
txtid = require('#/utils').txtid

module.exports = do ->
  class Survey extends $surveyFragment.SurveyFragment
    constructor: (options={}, addlOpts)->
      super()
      if options.error
        throw new Error("instantiating survey with error parameter")
      @_initialParams = options

      @settings = new Settings(options.settings, _parent: @)
      if !options.settings
        @settings.enable_auto_name()

      if (sname = @settings.get("name") or options.name)
        @set("name", sname)

      ###
      # We don't use locking profiles in any way yet, so we just store it for
      # saving - for checking these out, coffee code is using raw survey JSON.
      ###
      @lockingProfiles = options[LOCKING_PROFILES_PROP_NAME]

      @newRowDetails = options.newRowDetails || $configs.newRowDetails
      @defaultsForType = options.defaultsForType || $configs.defaultsForType

      @surveyDetails = new $surveyDetail.SurveyDetails([], _parent: @).loadSchema(options.surveyDetailsSchema || $configs.surveyDetailSchema)
      @choices = new $choices.ChoiceLists([], _parent: @)
      $inputParser.loadChoiceLists(options.choices || [], @choices)

      if options.survey
        if !$inputParser.hasBeenParsed(options)
          options.survey = $inputParser.parseArr(options.survey)
        for r in options.survey
          if typeof r.id isnt 'undefined'
            throw new Error("Forbidden column `id` for row: #{JSON.stringify(r, null, 2)}")

          if r.type in $configs.surveyDetailSchema.typeList()
            @surveyDetails.importDetail(r)
          else
            @rows.add r, collection: @rows, silent: true, _parent: @rows
      else
        @surveyDetails.importDefaults()
      @context =
        warnings: []
        errors: []
      @forEachRow (r)=>
        if typeof r.linkUp is 'function'
          r.linkUp(@context)
        return
      @linkUpChoiceLists()

    @create: (options={}, addlOpts) ->
      return new Survey(options, addlOpts)

    linkUpChoiceLists: ->
      # In case of cascading selects, this will ensure choiceLists are connected to
      # sub choice lists through a private "__cascadeList" property
      choiceKeys = @choices.getListNames()
      for choiceList in @choices.models
        overlapping_choice_keys = _.intersection(choiceKeys, choiceList.getOptionKeys(true))
        if overlapping_choice_keys.length > 1
          throw new Error("cascading choices can only reference one choice list")
        else if overlapping_choice_keys.length is 1
          choiceList.__cascadedList = @choices.get(overlapping_choice_keys[0])
      return

    insert_row: (row, index) ->
      # TODO: why? `_isCloned` is being used only once, in `ScoreRankMixin`'s `clone` function.
      if row._isCloned
        @rows.add(row, at: index)
      else
        @rows.add(row.toJSON(), at: index)
      new_row = @rows.at(index)
      survey = @getSurvey()
      if rowlist = row.getList()
        survey.choices.add(options: rowlist.options.toJSON())
        new_row.get('type').set('list', rowlist)
      name_detail = new_row.get('name')
      return name_detail.set 'value', name_detail.deduplicate(survey)

    _ensure_row_list_is_copied: (row)->
      if !row.rows && rowlist = row.getList()
        @choices.add(name: rowlist.get("name"), options: rowlist.options.toJSON())
      return

    insertSurvey: (survey, index=-1, targetGroupId)->
      index = @rows.length if index is -1
      for row, row_i in survey.rows.models
        # if target is a group, not root list of rows, we need to switch
        target = @
        if targetGroupId
          foundGroup = @findRowByCid(targetGroupId, {includeGroups: true})
          if foundGroup
            target = foundGroup
          else
            throw new Error("Couldn't find group #{targetGroupId}!")

        index_incr = index + row_i

        # inserting a group
        if row.rows
          if row.forEachRow
            row.forEachRow(
              (r) => @_ensure_row_list_is_copied(r),
              {includeGroups: true}
            )

          @_insertRowInPlace(
            row,
            {
              index: index_incr,
              parent: target,
              noDetach: true
            }
          )

          # inserting a group (block from Library) doesn't trigger change event
          # anywhere else, so we do it here manually
          @trigger('change')
        # inserting a question
        else
          @_ensure_row_list_is_copied(row)
          name_detail = row.get('name')
          name_detail.set 'value', name_detail.deduplicate(@)
          target.rows.add(
            row.toJSON(),
            at: index_incr
          )
      return

    toFlatJSON: (stringify=false, spaces=4)->
      obj = @toJSON()

      obj.survey = for row in obj.survey
        if _.isObject(row.type)
          row.type = [
            _.keys(row.type)[0], _.values(row.type)[0]
          ].join(' ')
        row
      if _.isObject(obj.choices)
        flattened_choices = []
        for own key, val of obj.choices
          for list_item in val
            _c = $.extend({list_name: key}, list_item)
            delete _c.setManually
            flattened_choices.push(_c)
        obj.choices = flattened_choices

      obj.settings = [@settings.attributes]

      if @lockingProfiles
        obj[LOCKING_PROFILES_PROP_NAME] = @lockingProfiles

      if stringify
        return JSON.stringify(obj, null, spaces)
      else
        return obj

    toJSON: (stringify=false, spaces=4)->
      obj = {}

      addlSheets =
        choices: new $choices.ChoiceLists()

      obj.survey = do =>
        out = []
        fn = (r)->
          if 'getList' of r and (l = r.getList())
            addlSheets.choices.add(l)

          if typeof r.export_relevant_values is 'function'
            r.export_relevant_values(out, addlSheets)
          else
            console.error 'No r.export_relevant_values. Does this survey have non-standard columns?', r
          return

        @forEachRow fn, includeGroupEnds: true

        for sd in @surveyDetails.models when sd.get("value")
          out.push sd.toJSON()

        return out

      for shtName, sheet of addlSheets when sheet.length > 0
        obj[shtName] = sheet.summaryObj(true)

      if stringify
        return JSON.stringify(obj, null, spaces)
      else
        return obj
    getSurvey: -> @
    log: (opts={})->
      logFn = opts.log or (a...)-> console.log.apply(console, a)
      tabs = ['-']
      logr = (r)->
        if 'forEachRow' of r
          logFn tabs.join('').replace(/-/g, '='), r.get('label').get('value')
          tabs.push('-')
          r.forEachRow(logr, flat: true, includeGroups: true)
          return tabs.pop()
        else
          return logFn tabs.join(''), r.get('label').get('value')
      @forEachRow(logr, flat: true, includeGroups: true)
      return

    summarize: ->
      rowCount = 0
      hasGps = false
      fn = (r)->
        if r.get('type').get('value') is 'geopoint'
          hasGps = true
        rowCount++
        return
      @forEachRow(fn, includeGroups: false)

      # summaryObj
      return {
        rowCount: rowCount
        hasGps: hasGps
      }
    _insertRowInPlace: (row, opts={})->
      if row._parent && !opts.noDetach
        row.detach(silent: true)
      index = 0
      if opts.index
        index = opts.index
      previous = opts.previous
      parent = opts.parent
      if previous
        parent = previous.parentRow()
        index = parent.rows.indexOf(previous) + 1
      if !parent
        parent = @
      parent.rows.add(row, {at: index})

      # line below looks like BAD CODE™ but in fact it enables row reordering
      row._parent = parent.rows

      if opts.event
        parent.rows.trigger(opts.event)
      return

    prepCols: (cols, opts={}) ->
      exclude = opts.exclude or []
      add = opts.add or []
      if _.isString(exclude) or _.isString(add)
        throw new Error("prepCols parameters should be arrays")
      out = _.filter _.uniq( _.flatten cols), (col) -> col not in exclude
      return out.concat.apply(out, add)

    toSsStructure: ()->
      out = {}
      for sheet, content of @toCsvJson()
        out[sheet] = content.rowObjects
      return out
    toCsvJson: ()->
      # build an object that can be easily passed to the "csv" library
      # to generate the XL(S)Form spreadsheet

      @finalize()

      out = {}
      out.survey = do =>
        oCols = ["name", "type", "label"]
        oRows = []

        addRowToORows = (r)->
          colJson = r.toJSON()
          for own key, val of colJson when key not in oCols
            oCols.push key
          return oRows.push colJson

        @forEachRow addRowToORows, includeErrors: true, includeGroupEnds: true
        for sd in @surveyDetails.models when sd.get("value")
          addRowToORows(sd)

        return {
          columns: oCols
          rowObjects: oRows
        }


      choicesCsvJson = do =>
        lists = new $choices.ChoiceLists()
        @forEachRow (r)->
          _getSubLists = (item)->
            if 'getList' of item
              list = item.getList()
              if list and !lists.get(list.get('name'))
                lists.add(list)
                return _getSubLists(list)
          return _getSubLists(r)

        rows = []
        cols = []
        for choiceList in lists.models
          choiceList.set("name", txtid(), silent: true)  unless choiceList.get("name")
          choiceList.finalize()
          clAtts = choiceList.toJSON()
          clName = clAtts.name
          for option in clAtts.options
            cols.push _.keys option
            rows.push _.extend {}, option, "list_name": clName


        if rows.length > 0
          return {
            columns: @prepCols cols, exclude: ['setManually'], add: ['list_name']
            rowObjects: rows
          }
        else
          return false

      out.choices = choicesCsvJson  if choicesCsvJson
      out.settings = @settings.toCsvJson()

      return out

    toMarkdown: ()->
      return $markdownTable.csvJsonToMarkdown(@toCsvJson())

    toCSV: ->
      sheeted = csv.sheeted()
      for shtName, content of @toCsvJson()
        sheeted.sheet shtName, csv(content)
      return sheeted.toString()

  Survey.load = (csv_repr, _usingSurveyLoadCsv=false)->
    # log('switch to Survey.load.csv')  if !_usingSurveyLoadCsv
    if _.isString(csv_repr) and not _is_csv(csv_repr)
      throw Error("Invalid CSV passed to form builder")
    _deserialized = $inputDeserializer.deserialize csv_repr
    _parsed = $inputParser.parse _deserialized
    return new Survey(_parsed)

  Survey.load.csv = (csv_repr)->
    return Survey.load(csv_repr, true)

  Survey.load.md = (md)->
    sObj = $markdownTable.mdSurveyStructureToObject(md)
    return new Survey(sObj)
  Survey.loadDict = (obj, baseSurvey)->
    _parsed = $inputParser.parse(obj, baseSurvey)
    return new Survey(_parsed)

  _is_csv = (csv_repr)->
    # checks that a string has a newline and a comma,
    # a very simplistic test of a csv
    return '\n' in csv_repr and ',' in csv_repr

  # Settings (assigned to each $survey.Survey instance)
  class Settings extends $base.BaseModel
    validation: {}
    toCsvJson: ->
      columns = _.keys(@attributes)
      rowObjects = [@toJSON()]

      return {
        columns: columns
        rowObjects: rowObjects
      }
    enable_auto_name: () ->
      @auto_name = true

      @on 'change:form_id', () =>
        if @changing_form_title
          @changing_form_title = false
        else
          @auto_name = false
        return

      @on 'change:form_title', (model, value) =>
        if @auto_name
          @changing_form_title = true
          @set 'form_id', $modelUtils.sluggifyLabel(value)
        return
      return



  return {
    Survey: Survey
    Settings: Settings
  }
