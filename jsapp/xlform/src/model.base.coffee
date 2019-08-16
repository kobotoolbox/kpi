_ = require 'underscore'
Backbone = require 'backbone'
validation = require 'backbone-validation'
$viewUtils = require './view.utils'
$configs = require './model.configs'
$rowDetailMixins = require './model.rowDetailMixins'

module.exports = do ->
  _.extend validation.validators, {
    invalidChars: (value, attr, customValue)->
      unless $viewUtils.Validator.__validators.invalidChars(value, customValue)
        "#{value} contains invalid characters";
    unique: (value, attr, customValue, model)->
      rows = model.getSurvey().rows.pluck(model.key)
      values = _.map(rows, (rd)-> rd.get('value'))
      unless $viewUtils.Validator.__validators.unique(value, values)
        "Question name isn't unique"
      else
        ``
  }

  _.extend(Backbone.Model.prototype, validation.mixin);

  # TODO: Extend Backbone Validation
  # _.extend Backbone.Model.prototype, Backbone.Validation.mixin

  base = {}
  class base.BaseCollection extends Backbone.Collection
    constructor: (arg, opts)->
      if arg and "_parent" of arg
        # temporary error, during transition
        throw new Error("_parent chould be assigned as property to 2nd argument to XLF.BaseCollection (not first)")
      @_parent = opts._parent  if opts and opts._parent
      super(arg, opts)

    getSurvey: ->
      parent = @_parent
      while parent._parent
        parent = parent._parent
      parent

  class base.BaseModel extends Backbone.Model
    constructor: (arg, opts)->
      if opts and "_parent" of opts
        @_parent = opts._parent
      else if "object" is typeof arg and "_parent" of arg
        @_parent = arg._parent
        delete arg._parent
      super(arg, opts)
    parse: ->
    linkUp: (ctx)->
    finalize: ->
    getValue: (what)->
      if what
        resp = @get(what)
        if resp is undefined
          throw new Error("Could not get value")
        if resp.getValue
          resp = resp.getValue()
      else
        resp = @get("value")
      resp
    setDetail: (what, value)->
      if value.constructor is base.RowDetail
        @set(what, value)
      else
        @set(what, new base.RowDetail({key:what, value: value}, {_parent: @}))
    parentRow: ->
      @_parent._parent
    precedingRow: ->
      ii = @_parent.models.indexOf(@)
      if ii isnt 0
        @_parent.at(ii-1)
    nextRow: ->
      ii = @_parent.models.indexOf(@)
      @_parent.at(ii+1)
    getSurvey: ->
      parent = @_parent
      if parent is null or parent is undefined
        return null
      while parent._parent or parent.collection
        if parent._parent
          parent = parent._parent
        else if parent.collection and parent.collection._parent
          parent = parent.collection._parent
        else
          break
      parent

  _innerValue = (val)->
    # occasionally, the value passed to rowDetail
    # is an object, which evaluates to true
    if _.isObject(val)
      val.value
    else
      val

  class base.RowDetail extends base.BaseModel
    idAttribute: "name"
    validation: () =>
      if @key == 'name'
        return value:
          unique: true
          required: true
      else if @key == 'calculation'
        return value:
          required: true
      else if @key == 'label' && @_parent.constructor.key != 'group'
        return value:
          required: true
      {}

    constructor: ({@key, value}, opts)->
      @_parent = opts._parent
      if @key of $rowDetailMixins
        _.extend(@, $rowDetailMixins[@key])
      super()
      # We should consider pulling the value from the CSV at this stage
      # depending on the question type. truthy-CSV values should be set here
      # In the quick fix, this is done in the view for 'required' rowDetails
      # (grep: XLF.configs.truthyValues)

      if value not in [undefined, null]
        vals2set = {}
        if _.isString(value) || _.isNumber(value)
          vals2set.value = value
        else if _.isObject(value) and "value" of value
          _.extend vals2set, value
        else
          vals2set.value = value
        @set(vals2set)

      @_order = $configs.columnOrder(@key)
      @postInitialize()

    postInitialize: ()->
    initialize: ()->
      # todo: change "_hideUnlessChanged" to describe something about the form, not the representation of the form.
      # E.g. undefinedUnlessChanged or definedIffChanged
      if @get("_hideUnlessChanged")
        @hidden = true
        @_oValue = @get("value")
        @on "change", ()->
          @hidden = @get("value") is @_oValue

      @on "change:value", (rd, val, ctxt)=>
        # @_parent.trigger "change", @key, val, ctxt
        @_parent.trigger "detail-change", @key, val, ctxt
        @getSurvey().trigger "row-detail-change", @_parent, @key, val, ctxt
      # if @key is "type"
      #   @on "change:list", (rd, val, ctxt)=>
      #     @_parent.trigger "change", @key, val, ctxt

      # when attributes change, register changes with parent survey
      if @key in ["name", "label", "hint", "guidance_hint", "required",
                  "calculation", "default", "appearance",
                  "constraint_message", "tags"] or @key.match(/^.+::.+/)
        @on "change", (changes)=>
          @getSurvey().trigger "change", changes

  base
