global = @

_ = require 'underscore'
Backbone = require 'backbone'
alertify = require 'alertifyjs'
base = require './model.base'
$configs = require './model.configs'
$utils = require './model.utils'
$surveyDetail = require './model.surveyDetail'
$aliases = require './model.aliases'
$rowDetail = require './model.rowDetail'
$choices = require './model.choices'
$skipLogicHelpers = require './mv.skipLogicHelpers'
readParameters = require('#/components/formBuilder/formBuilderUtils').readParameters
writeParameters = require('#/components/formBuilder/formBuilderUtils').writeParameters
txtid = require('#/utils').txtid
notify = require('#/utils').notify

module.exports = do ->
  row = {}

  class row.BaseRow extends base.BaseModel
    @kls = "BaseRow"
    constructor: (attributes={}, options={})->
      for key, val of attributes when key is ""
        delete attributes[key]
      super(attributes, options)

    ensureKuid: ->
      if '$kuid' not of @attributes
        @set '$kuid', txtid()
      return

    initialize: ->
      @ensureKuid()
      @convertAttributesToRowDetails()
      return

    isError: -> false
    convertAttributesToRowDetails: ->
      for key, val of @attributes
        unless val instanceof $rowDetail.RowDetail
          @set key, new $rowDetail.RowDetail({key: key, value: val}, {_parent: @}), {silent: true}
      return
    attributesArray: ()->
      arr = ([k, v] for k, v of @attributes)
      arr.sort (a,b)-> if a[1]._order < b[1]._order then -1 else 1
      return arr

    isGroup: ->
      return @constructor.kls is "Group"

    isInGroup: ->
      return @_parent?._parent?.constructor.kls is "Group"

    detach: (opts)->
      if @_parent
        @_parent.remove @, opts
        @_parent = null
      return

    selectableRows: () ->
      questions = []
      limit = false

      non_selectable = ['datetime', 'time', 'note', 'calculate', 'group', 'kobomatrix', 'repeat', 'rank', 'score']

      survey = @getSurvey()
      if survey == null
        return null
      survey.forEachRow (question) =>
        limit = limit || question is @
        if !limit && question.getValue('type') not in non_selectable
          questions.push question
          return
      , includeGroups:true
      return questions

    export_relevant_values: (survey_arr, additionalSheets)->
      survey_arr.push @toJSON2()
      return

    # TODO: see if we need both toJSON* methods, and if yes, please describe both (differences)
    toJSON2: ->
      outObj = {}
      for [key, val] in @attributesArray()
        if key is 'type' and val.get('typeId') in ['select_one', 'select_multiple']
          outObj['type'] = val.get('typeId')
          outObj['select_from_list_name'] = val.get('listName')
          continue
        else
          result = @getValue(key)
        unless @hidden
          if _.isBoolean(result)
            outObj[key] = $configs.boolOutputs[if result then "true" else "false"]
          else if '' isnt result
            outObj[key] = result
      return outObj

    toJSON: ->
      outObj = {}
      for [key, val] in @attributesArray()
        result = @getValue(key)
        unless @hidden
          if _.isBoolean(result)
            outObj[key] = $configs.boolOutputs[if result then "true" else "false"]
          else
            outObj[key] = result
      return outObj

  class SimpleRow extends Backbone.Model
    finalize: -> ``
    simpleEnsureKuid: ->
      if '$kuid' not of @attributes
        @set('$kuid', txtid())
      return
    getTypeId: -> @get('type')
    linkUp: ->
    _isSelectQuestion: ()-> false
    get_type: ->
      return $skipLogicHelpers.question_types[@getTypeId()] || $skipLogicHelpers.question_types['default']
    getValue: (which)-> @get(which)

  class RankRow extends SimpleRow
    initialize: ->
      @simpleEnsureKuid()
      @set('type', 'rank__level')
      return
    export_relevant_values: (surv, sheets)->
      surv.push @attributes
      return

  class ScoreRankMixin
    _extendAll: (rr)->
      extend_to_row = (val, key)=>
        if _.isFunction(val)
          rr[key] = (args...)->
            return val.apply(rr, args)
        else
          rr[key] = val
        return
      _.each @, extend_to_row
      extend_to_row(@forEachRow, 'forEachRow')
      _begin_kuid = rr.getValue('$kuid', false)
      _end_json = @end_json({"$kuid": "/#{_begin_kuid}"})

      rr._afterIterator = (cb, ctxt)->
        obj =
          export_relevant_values: (surv, addl)->
            surv.push _.extend({}, _end_json)
            return
          toJSON: ->
            return _.extend({}, _end_json)

        if ctxt.includeGroupEnds
          return cb(obj)

      _toJSON = rr.toJSON

      rr.clone = ()->
        attributes = rr.toJSON2()

        # Strip unique IDs and old list references from the main row (to force autofill of proper values)
        delete attributes['$kuid']
        delete attributes['kobo--rank-items']
        delete attributes['kobo--score-choices']

        options =
          _parent: rr._parent
          add: false
          merge: false
          remove: false
          silent: true

        r2 = new row.Row(attributes, options)
        r2._isCloned = true

        if rr._rankRows
          # if rr is a rank question
          for rankRow in rr._rankRows.models
            rankRowJson = rankRow.toJSON()
            # Strip $kuid from sub-rows
            delete rankRowJson['$kuid']
            r2._rankRows.add(rankRowJson)

          r2._rankLevels = rr.getSurvey().choices.add(name: txtid())
          for item in rr.getList().options.models
            itemJson = item.toJSON()
            # Strip $kuid from items
            delete itemJson['$kuid']
            r2._rankLevels.options.add(itemJson)

          r2.set('kobo--rank-items', r2._rankLevels.get('name'))
          @convertAttributesToRowDetails()
          r2.get('type').set('list', r2._rankLevels)
        else
          # if rr is a score question
          for scoreRow in rr._scoreRows.models
            scoreRowJson = scoreRow.toJSON()
            # Strip $kuid from sub-rows
            delete scoreRowJson['$kuid']
            r2._scoreRows.add(scoreRowJson)

          r2._scoreChoices = rr.getSurvey().choices.add(name: txtid())
          for item in rr.getList().options.models
            itemJson = item.toJSON()
            # Strip $kuid from items
            delete itemJson['$kuid']
            r2._scoreChoices.options.add(itemJson)

          r2.set('kobo--score-choices', r2._scoreChoices.get('name'))
          @convertAttributesToRowDetails()
          r2.get('type').set('list', r2._scoreChoices)

        return r2

      rr.toJSON = ()->
        return _.extend _toJSON.call(rr), {
          'type': "begin_#{rr._beginEndKey()}"
        }, @_additionalJson?()

      _.each @constructor.prototype, extend_to_row
      if rr.attributes.__rows
        for subrow in rr.attributes.__rows
          @[@_rowAttributeName].add(subrow)
        delete rr.attributes.__rows
      return

    getValue: (which)->
      return @get(which)

    end_json: (mrg={})->
      return _.extend({type: "end_#{@_beginEndKey()}"}, mrg)

    forEachRow: (cb, ctx)->
      cb(@)
      @[@_rowAttributeName].each (subrow)-> cb(subrow)
      if '_afterIterator' of @
        return @_afterIterator(cb, ctx)


  class RankRows extends Backbone.Collection
    model: RankRow

  class RankMixin extends ScoreRankMixin
    constructor: (rr)->
      @_rankRows = new RankRows()
      @_rowAttributeName = '_rankRows'
      @_extendAll(rr)
      rankConstraintMessageKey = 'kobo--rank-constraint-message'
      if !rr.get(rankConstraintMessageKey)
        rr.set(rankConstraintMessageKey, t("Items cannot be selected more than once"))

    _beginEndKey: ->
      return 'rank'

    linkUp: (ctx)->
      rank_list_id = @get('kobo--rank-items')?.get('value')
      if rank_list_id
        @_rankLevels = @getSurvey().choices.get(rank_list_id)
      else
        @_rankLevels = @getSurvey().choices.create()
      @_additionalJson = =>
        return 'kobo--rank-items': @getList().get('name')
      @getList = => @_rankLevels
      return

    export_relevant_values: (survey_arr, additionalSheets)->
      if @_rankLevels
        additionalSheets['choices'].add(@_rankLevels)
      begin_xlsformrow = _.clone(@toJSON2())
      begin_xlsformrow.type = "begin_rank"
      begin_xlsformrow['kobo--rank-items'] = @getList().get('name')
      survey_arr.push(begin_xlsformrow)
      return

  class ScoreChoiceList extends Array

  class ScoreRow extends SimpleRow
    initialize: ->
      @set('type', 'score__row')
      @simpleEnsureKuid()
      return
    export_relevant_values: (surv, sheets)->
      surv.push(@attributes)
      return

  class ScoreRows extends Backbone.Collection
    model: ScoreRow

  class ScoreMixin extends ScoreRankMixin
    constructor: (rr)->
      @_scoreRows = new ScoreRows()
      @_rowAttributeName = '_scoreRows'
      @_extendAll(rr)

    _beginEndKey: ->
      return 'score'

    linkUp: (ctx)->
      @getList = ()=> @_scoreChoices
      @_additionalJson = ()=>
        return 'kobo--score-choices': @getList().get('name')
      score_list_id_item = @get('kobo--score-choices')
      if score_list_id_item
        score_list_id = score_list_id_item.get('value')
        if score_list_id
          @_scoreChoices = @getSurvey().choices.get(score_list_id)
        else
          ctx.warnings.push "Score choices list not found"
          @_scoreChoices = @getSurvey().choices.add({})
      else
        ctx.warnings.push "Score choices list not set"
        @_scoreChoices = @getSurvey().choices.add(name: txtid())
      return

    export_relevant_values: (survey_arr, additionalSheets)->
      score_list = @_scoreChoices
      if score_list
        additionalSheets['choices'].add(score_list)
      output = _.clone(@toJSON2())
      output.type = "begin_score"
      output['kobo--score-choices'] = @getList().get('name')
      survey_arr.push(output)
      return

  class row.Row extends row.BaseRow
    @kls = "Row"
    initialize: ->
      ###
      The best way to understand the @details collection is
      that it is a list of cells of the XLSForm spreadsheet.
      The column name is the "key" and the value is the "value".
      We opted for a collection (rather than just saving in the attributes of
      this model) because of the various state-related attributes
      that need to be saved for each cell and this allows more room to grow.

      E.g.: {"key": "type", "value": "select_one colors"}
            needs to keep track of how the value was built
      ###
      if @_parent
        defaultsUnlessDefined = @_parent.newRowDetails || $configs.newRowDetails
        defaultsForType = @_parent.defaultsForType || $configs.defaultsForType
      else
        console?.error "Row not linked to parent survey."
        defaultsUnlessDefined = $configs.newRowDetails
        defaultsForType = $configs.defaultsForType

      if @attributes.type and @attributes.type of defaultsForType
        curTypeDefaults = defaultsForType[@attributes.type]
      else
        curTypeDefaults = {}

      defaults = _.extend {}, defaultsUnlessDefined, curTypeDefaults

      for key, vals of defaults
        unless key of @attributes
          newVals = {}
          for vk, vv of vals
            newVals[vk] = if ("function" is typeof vv) then vv() else vv
          @set key, newVals

      if '$kuid' not of @attributes
        @set '$kuid', txtid()

      _type = @getValue('type')

      if _type is 'score'
        new ScoreMixin(@)
      else if _type is 'rank'
        new RankMixin(@)
      @convertAttributesToRowDetails()

      typeDetail = @get("type")
      tpVal = typeDetail.get("value")
      select_from_list_name = @get("select_from_list_name")
      if select_from_list_name and tpVal
        tpVal = "#{tpVal} #{select_from_list_name.get('value')}"
        typeDetail.set("value", tpVal, silent: true)

      processType = (rd, newType, ctxt)=>
        # if value changes, it could be set from an initialization value
        # or it could be changed elsewhere.
        # we need to keep typeId, listName, and orOther in sync.
        if _.isObject(newType)
          tpid = _.keys(newType)[0]
          p2 = _.values(newType)[0]
        else
          [tpid, p2, p3] = newType.split(" ")

        typeDetail.set("typeId", tpid, silent: true)
        if p2
          typeDetail.set("listName", p2, silent: true)
          matchedList = @getSurvey().choices.get(p2)
          if matchedList
            typeDetail.set("list", matchedList)
        if p3 is "or_other" or tpid in ["select_one_or_other", "select_multiple_or_other"]
          typeDetail.set("orOther", p3, silent: true)
        if (rtp = $configs.lookupRowType(tpid))
          typeDetail.set("rowType", rtp, silent: true)
        else
          throw new Error "type `#{tpid}` not found"
        return
      processType(typeDetail, tpVal, {})
      typeDetail.on "change:value", processType
      typeDetail.on "change:listName", (rd, listName, ctx)->
        rtp = typeDetail.get("rowType")
        typeStr = "#{typeDetail.get("typeId")}"
        if rtp.specifyChoice and listName
          typeStr += " #{listName}"
        if rtp.orOtherOption and typeDetail.get("orOther")
          typeStr += " or_other"
        typeDetail.set({value: typeStr}, silent: true)
        return
      typeDetail.on "change:list", (rd, cl, ctx)->
        if typeDetail.get("rowType").specifyChoice
          clname = cl.get("name")
          unless clname
            clname = txtid()
            cl.set("name", clname, silent: true)
          @set("value", "#{@get('typeId')} #{clname}")
        return
      return
    getTypeId: ->
      return @get('type').get('typeId')

    # Clones given row in a deep way (i.e. also clones list of choices etc.)
    clone: ->
      attributes = {}
      options =
        _parent: @_parent
        add: false
        merge: false
        remove: false
        silent: true

      _.each @attributes, (value, key) =>
        # Prevent copying the hardcoded list reference and the unique row id. They will be autofilled with proper values
        # in the lines below
        if key not in ['$kuid', 'select_from_list_name']
          attributes[key] = @getValue key

      newRow = new row.Row(attributes, options)

      # For few distinct types we need to do a bit more work
      newRowType = newRow.get('type')
      if newRowType.get('typeId') in ['select_one', 'select_multiple']
        # Clone the choices list (as it is a distinct entity)
        clonedList = @getList().clone()

        # Ensure new list has a unique name
        listName = txtid()
        # We use `silent` to not cause unnecessary re-renders. We are going to `trigger('change')` few lines below after
        # cloning is done.
        clonedList.set('name', listName, {silent: true})

        # Register the cloned list with the global choices collection
        @getSurvey().choices.add(clonedList)

        # Bind the new list and explicitly overwrite the type string
        newRowType.set('list', clonedList)
        newRowType.set('listName', listName)
        newRowType.set('value', "#{newRowType.get('typeId')} #{listName}")

      @getSurvey().trigger('change')

      return newRow

    finalize: ->
      existing_name = @getValue("name")
      unless existing_name
        names = []
        @getSurvey().forEachRow (r)->
          name = r.getValue("name")
          names.push(name)  if name
          return
        label = @getValue("label")
        @get("name").set("value", $utils.sluggifyLabel(label, names))
      return @

    get_type: ->
      return $skipLogicHelpers.question_types[@getTypeId()] || $skipLogicHelpers.question_types['default']

    _isSelectQuestion: ->
      return @get('type').get('typeId') in ['select_one', 'select_multiple']

    getAcceptedFiles: -> return @attributes['body::accept']?.attributes?.value

    setAcceptedFiles: (bodyAcceptString) ->
      @setDetail('body::accept', bodyAcceptString)
      return

    getParameters: -> readParameters(@attributes.parameters?.attributes?.value)

    setParameters: (paramObject) ->
      paramString = writeParameters(paramObject)
      @setDetail('parameters', paramString)
      return

    getList: ->
      _list = @get('type')?.get('list')
      if (not _list) and @_isSelectQuestion()
        _list = new $choices.ChoiceList(name: txtid())
        @setList(_list)
      return _list

    setList: (list)->
      listToSet = @getSurvey().choices.get(list)
      unless listToSet
        @getSurvey().choices.add(list)
        listToSet = @getSurvey().choices.get(list)
      throw new Error("List not found: #{list}")  unless listToSet
      @get("type").set("list", listToSet)
      return
    parse: ->
      val.parse()  for key, val of @attributes
      return

    linkUp: (ctx)->
      val.linkUp(ctx)  for key, val of @attributes
      return

  class row.RowError extends row.BaseRow
    constructor: (obj, options)->
      @_error = options.error
      unless window.xlfHideWarnings
        console?.error("Error creating row: [#{options.error}]", obj)
        notify.error("Error creating row: [#{options.error}]")
      super(obj, options)
    isError: -> true
    getValue: (what)->
      if what of @attributes
        return @attributes[what].get('value')
      else
        return "[error]"

  return row
