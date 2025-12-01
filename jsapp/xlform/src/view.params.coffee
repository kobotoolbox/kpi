_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

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
      # if a parameter is unset, initialize it to the parameter's default, if there is one
      if  @paramValue is '' and
          typeof @paramDefault isnt 'undefined' and
          # exception: for max-pixels, a blank value should be preserved as unset
          @paramType isnt 'maxPixels'
        @onParamChange(@paramName, @paramDefault)
      return

    render: ->
      template = $($viewTemplates.$$render("ParamsView.#{@paramType}Param", @paramName, @paramValue, @paramDefault))
      @$el.html(template)
      return @

    onChange: (evt) ->
      val = undefined
      if @paramType is $configs.paramTypes.number
        val = evt.currentTarget.value
        # make sure that params without removed values keep using default one
        # TODO: is this the behaviour we want to have?
        if val is '' and typeof @paramDefault isnt 'undefined'
          val = "#{@paramDefault}"
      else if @paramType is $configs.paramTypes.boolean
        val = evt.currentTarget.checked
      else if @paramType is $configs.paramTypes.maxPixels
        if evt.currentTarget.value is ' ' then evt.currentTarget.value = ''
        val = +evt.currentTarget.value
        if !val then val = undefined   # +'', +' ' or +'0' unsets max-pixels

      @onParamChange(@paramName, val)
      return

  return ParamsView: ParamsView
