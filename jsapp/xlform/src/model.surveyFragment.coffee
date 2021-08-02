
_ = require 'underscore'
Backbone = require 'backbone'
$base = require './model.base'
$row = require './model.row'
$aliases = require './model.aliases'
$utils = require './model.utils'
$configs = require './model.configs'
$surveyDetail = require './model.surveyDetail'
$skipLogicHelpers = require './mv.skipLogicHelpers'

module.exports = do ->
  _t = require("utils").t

  surveyFragment = {}

  class KobomatrixRow extends Backbone.Model
    _isSelectQuestion: -> false

  class KobomatrixRows extends Backbone.Collection
    model: KobomatrixRow

  class KobomatrixMixin
    constructor: (rr)->
      @_kobomatrix_columns = new KobomatrixRows()
      @_rowAttributeName = '_kobomatrix_columns'

      extend_to_row = (val, key)=>
        if _.isFunction(val)
          rr[key] = (args...)->
            val.apply(rr, args)
        else
          rr[key] = val
      _.each @, extend_to_row
      extend_to_row(@forEachRow, 'forEachRow')

      _begin_kuid = rr.getValue('$kuid', false)
      _end_json = {
        "type": "end_#{@_beginEndKey()}"
        "$kuid": "/#{_begin_kuid}"
      }
      rr._afterIterator = (cb, ctxt)->
        obj =
          export_relevant_values: (surv, addl)->
            surv.push _.extend({}, _end_json)
          toJSON: ->
            _.extend({}, _end_json)

        cb(obj)  if ctxt.includeGroupEnds

      _toJSON = rr.toJSON

      rr.clone = ()->
        console.error('clone kobomatrix rows')

      rr.toJSON = ()->
        _.extend _toJSON.call(rr), {
          'type': "begin_#{rr._beginEndKey()}"
        }, @_additionalJson?()

      _.each @constructor.prototype, extend_to_row

      if rr.attributes.__rows
        for subrow in rr.attributes.__rows
          @[@_rowAttributeName].add(subrow)
        delete rr.attributes.__rows


    _kobomatrix_cols: ->
      @rows

    _isSelectQuestion: -> false
    get_type: -> $skipLogicHelpers.question_types['default']
    _beginEndKey: ->
      'kobomatrix'

    linkUp: (ctx)->
      @getList = ()=> @items
      items = {}
      kobomatrix_list = @get('kobo--matrix_list')?.get('value')

      if kobomatrix_list
        items[kobomatrix_list] = @getSurvey().choices.get(kobomatrix_list)
      else
        kobomatrix_list = @.set('kobo--matrix_list', "matrix_#{$utils.txtid()}")
        items[kobomatrix_list] = @getSurvey().choices.create()

      @rows.each (row)=>
        if listName = row.get('select_from_list_name')?.get('value')
          items[listName] = @getSurvey().choices.get(listName)

      @items = items
      @items


  passFunctionToMetaModel = (obj, fname)->
    obj["__#{fname}"] = obj[fname]
    obj[fname] = (args...) -> obj._meta[fname].apply(obj._meta, args)

  _forEachRow = (cb, ctx)->
    @_beforeIterator(cb, ctx)  if '_beforeIterator' of @
    unless 'includeErrors' of ctx
      ctx.includeErrors = false
    @rows.each (r, index, list)->
      if typeof r.forEachRow is 'function'
        if ctx.includeGroups
          cb(r)
        if not ctx.flat
          r.forEachRow cb, ctx
      else if r.isError()
        cb(r)  if ctx.includeErrors
      else
        cb(r)
    @_afterIterator(cb, ctx)  if '_afterIterator' of @
    return

  class surveyFragment.SurveyFragment extends $base.BaseCollection
    constructor: (a,b)->
      @rows = new Rows([], _parent: @)
      @_meta = new Backbone.Model()
      passFunctionToMetaModel(@, "set")
      passFunctionToMetaModel(@, "get")
      passFunctionToMetaModel(@, "on")
      passFunctionToMetaModel(@, "off")
      passFunctionToMetaModel(@, "trigger")
      super(a,b)
    _validate: ->
      @clearErrors()
      isValid = true
      if !@settings.get('form_id')
        @addError('form id must not be empty')
        isValid = false

      if !@settings.get('form_title')
        @addError('form title must not be empty')
        isValid = false

      return isValid
    clearErrors: () ->
      @errors = []
    addError: (message) ->
      @errors.push message
    linkUp: (ctx)-> @invoke('linkUp', ctx)
    forEachRow: (cb, ctx={})->
      _forEachRow.apply(@, [cb, ctx])
    getRowDescriptors: () ->
      descriptors = []
      @forEachRow (row) ->
        descriptor =
          label: row.getValue('label')
          name: row.getValue('name')
        descriptors.push(descriptor)
      descriptors
    findRowByCid: (cid, options={})->
      match = false
      fn = (row)->
        if row.cid is cid
          match = row
        # maybe implement a way to bust out
        # of this loop with false response.
        !match
      @forEachRow fn, options
      match

    findRowByName: (name, opts)->
      match = false
      @forEachRow (row)->
        if (row.getValue("name") || $utils.sluggifyLabel row.getValue('label')) is name
          match = row
        # maybe implement a way to bust out
        # of this loop with false response.
        !match
      ,opts
      match
    addRowAtIndex: (r, index)-> @addRow(r, at: index)
    addRow: (r, opts={})->
      if (afterRow = opts.after)
        delete opts.after
        opts._parent = afterRow._parent
        index = 1 + opts._parent.models.indexOf(afterRow)
        opts.at = index
      else if (beforeRow = opts.before)
        delete opts.before
        opts._parent = beforeRow._parent
        index = opts._parent.models.indexOf(beforeRow)
        opts.at = index
      else
        opts._parent = @rows
      opts._parent.add r, opts

    detach: ->
      @_parent.remove(@)
      ``

    remove: (item)->
      item.detach()

    _addGroup: (opts)->
      # move to surveyFrag
      opts._parent = @rows

      unless 'type' of opts
        opts.type = 'group'

      unless '__rows' of opts
        opts.__rows = []

      opts.__rows = [].concat.apply([], opts.__rows)

      rowCids = []
      @forEachRow (
          (r)->
            rowCids.push(r.cid)
        ), includeGroups: true, includeErrors: true

      lowest_i = false
      for row in opts.__rows
        row_i = rowCids.indexOf row.cid
        if (lowest_i is false) or (row_i < lowest_i)
          lowest_i = row_i
          first_row = row

      addOpts =
        previous: first_row.precedingRow()
        parent: first_row.parentRow()
      for row in opts.__rows
        row.detach(silent: true)

      unless opts.label?
        opts.label = $configs.newGroupDetails.label.value
      grp = new surveyFragment.Group(opts)
      @getSurvey()._insertRowInPlace grp, addOpts
      par = addOpts.parent or @getSurvey().rows
      par.trigger('add', grp)

    _allRows: ->
      # move to surveyFrag
      rows = []
      @forEachRow ((r)-> rows.push(r)  if r.constructor.kls is "Row"), {}
      rows

    finalize: ->
      # move to surveyFrag
      @forEachRow ((r)=> r.finalize()), includeGroups: true
      @

  class surveyFragment.Group extends $row.BaseRow
    @kls = "Group"
    @key = "group"
    constructor: (a={}, b)->
      __rows = a.__rows or []
      if a.label == undefined
        a.label = ''
      @_parent = a._parent
      delete a.__rows
      @rows = new Rows([], _parent: @)
      super(a,b)
      @rows.add __rows  if __rows
      for row in __rows
        row._parent = row.collection = @rows

    _isSelectQuestion: -> false
    get_type: -> $skipLogicHelpers.question_types['default']

    initialize: ->
      grpDefaults = $configs.newGroupDetails
      for key, obj of grpDefaults
        if !@has key
          if typeof obj.value is 'function'
            @set key, obj.value(@)
          else
            @set key, obj
      @ensureKuid()
      typeIsRepeat = @get('type') is 'repeat'
      @set('_isRepeat', typeIsRepeat)
      @convertAttributesToRowDetails()
      if @getValue('type') is 'kobomatrix'
        new KobomatrixMixin(@)

    addRowAtIndex: (row, index) ->
      row._parent = @rows
      @rows.add(row, at:index)
    _isRepeat: ()->
      !!(@get("_isRepeat")?.get("value"))

    autoname: ->
      name = @getValue('name')
      if name in [undefined, '']
        slgOpts =
          lowerCase: false
          stripSpaces: true
          lrstrip: true
          incrementorPadding: 3
          validXmlTag: true
        new_name = $utils.sluggify(@getValue('label'), slgOpts)
        @setDetail('name', new_name)

    finalize: ->
      @autoname()

    detach: (opts)->
      @_parent.remove(@, opts)

    splitApart: ->
      startingIndex = @_parent.models.indexOf(@)
      @detach()
      for row, n in @rows.models
        row._parent = @_parent
        @_parent._parent.addRowAtIndex(row, startingIndex + n)
      return

    _beforeIterator: (cb, ctxt)->
      cb(@groupStart())  if ctxt.includeGroupEnds
    _afterIterator: (cb, ctxt)->
      cb(@groupEnd())  if ctxt.includeGroupEnds

    forEachRow: (cb, ctx={})->
      _forEachRow.apply(@, [cb, ctx])

    _groupOrRepeatKey: ->
      if @_isRepeat() then "repeat" else "group"

    groupStart: ->
      group = @
      export_relevant_values: (surv, shts)-> surv.push(@toJSON())
      toJSON: ->
        out = {}
        for k, val of group.attributes
          if k isnt '_isRepeat'
            out[k] = val.getValue()
        out.type = "begin_#{group._groupOrRepeatKey()}"
        out
    groupEnd: ->
      group = @
      _kuid = @getValue("$kuid")
      _as_json =
        type: "end_#{@_groupOrRepeatKey()}"
        $kuid: "/#{_kuid}"

      export_relevant_values: (surv, shts)->
        surv.push _.extend {}, _as_json
      toJSON: ()->
        _.extend {}, _as_json

  INVALID_TYPES_AT_THIS_STAGE = ['begin_group', 'end_group', 'begin_repeat', 'end_repeat']
  _determineConstructorByParams = (obj)->
    formSettingsTypes = do ->
      for key, val of $configs.defaultSurveyDetails
        val.name
    type = obj?.type
    if type in INVALID_TYPES_AT_THIS_STAGE
      # inputParser should have converted groups and repeats into a structure by this point
      throw new Error("Invalid type at this stage: #{type}")

    if type in formSettingsTypes
      # e.g. "today"
      throw new Error("#{type} is not properly handled as a SurveyDetail")
      $surveyDetail.SurveyDetail
    else if type is 'score'
      $row.Row
    else if type in ['group', 'repeat', 'kobomatrix']
      surveyFragment.Group
    else
      $row.Row

  class Rows extends $base.BaseCollection
    constructor: (args...)->
      super(args...)
      @on('add', (a,b,c) => @_parent.getSurvey().trigger('rows-add', a,b,c))
      @on('remove', (a,b,c) => @_parent.getSurvey().trigger('rows-remove', a,b,c))
    model: (obj, ctxt)->
      RowConstructor = _determineConstructorByParams(obj)
      try
        new RowConstructor(obj, _.extend({}, ctxt, _parent: ctxt.collection))
      catch e
        # Store exceptions in with the survey
        new $row.RowError(obj, _.extend({}, ctxt, error: e, _parent: ctxt.collection))
    comparator: (m)-> m.ordinal

  surveyFragment
