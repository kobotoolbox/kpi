_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

# TODO: allow unsetting a parameter, like max pixels.

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @parameters={}, @questionType}) ->
      @typeConfig = $configs.questionParams[@questionType]

      if @questionType is 'range'
        template = $viewTemplates.row.paramsSimple()
      else
        template = $viewTemplates.row.paramsSettingsField()

      @$el = $($.parseHTML(template))
      @$paramsViewEl = @$el.find('.params-view')
      return

    render: ->
      for paramName, paramConfig of @typeConfig
        new ParamOption(
          paramName,
          paramConfig.type,
          paramConfig.defaultValue,
          @parameters[paramName],
          @onParamChange.bind(@)
        ).render().$el.appendTo(@$paramsViewEl)
      return @

    ###
    # This is being used both for initialization of all parameters (and their existing values) and for handling changes
    # to them.
    ###
    onParamChange: (paramName, paramValue) ->
      @parameters[paramName] = paramValue
      @rowView.model.setParameters(@parameters)
      @rowView.model.getSurvey().trigger('change')
      return

    insertInDOM: (rowView) ->
      @$el.appendTo(rowView.defaultRowDetailParent)
      return

    insertInDOMAfter: ($el) ->
      @$el.insertAfter($el)
      return

  class ParamOption extends $baseView
    className: 'param-option js-cancel-sort js-cancel-select-row'
    events: {
      'input input': 'onChange'
    }

    initialize: (@paramName, @paramType, @paramDefault, @paramValue='', @onParamChange) ->
      if @paramValue is '' and typeof @paramDefault isnt 'undefined'
        # TODO: maybe not?
        # make sure that params without values use default one
        @onParamChange(@paramName, @paramDefault)
      return

    render: ->
      template = $($viewTemplates.$$render("ParamsView.#{@paramType}Param", @paramName, @paramValue, @paramDefault))
      @$el.html(template)
      return @

    onChange: (evt) ->
      if @paramType is $configs.paramTypes.number
        val = evt.currentTarget.value
        # make sure that params without removed values keep using default one
        # TODO: is this the behaviour we want to have?
        if val is '' and typeof @paramDefault isnt 'undefined'
          val = "#{@paramDefault}"
      else if @paramType is $configs.paramTypes.boolean
        val = evt.currentTarget.checked
      else if @paramType is $configs.paramTypes.maxPixels
        val = +evt.currentTarget.value # /\d{0,5}/ -> number
        if !val
          val = undefined   # '', ' ' or '0' unsets max-pixels
          evt.currentTarget.value = evt.currentTarget.value.trim()
      @onParamChange(@paramName, val)
      return

  return ParamsView: ParamsView
