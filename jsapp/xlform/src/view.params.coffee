_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @parameters={}, @questionType}) ->
      @typeConfig = $configs.questionParams[@questionType]
      @$el = $($.parseHTML($viewTemplates.row.paramsSettingsField()))
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

    onParamChange: (paramName, paramValue) ->
      @parameters[paramName] = paramValue
      @rowView.model.setParameters(@parameters)
      @rowView.model.getSurvey().trigger('change')
      return

    insertInDOM: (rowView)->
      @$el.appendTo(rowView.defaultRowDetailParent)
      return

  class ParamOption extends $baseView
    className: 'param-option'
    events: {
      'input input': 'onChange'
    }

    initialize: (@paramName, @paramType, @paramDefault, @paramValue='', @onParamChange) -> return

    render: ->
      template = $($viewTemplates.$$render("ParamsView.#{@paramType}Param", @paramName, @paramValue, @paramDefault))
      @$el.html(template)
      return @

    onChange: (evt) ->
      if @paramType is $configs.paramTypes.number
        val = evt.currentTarget.value
      else if @paramType is $configs.paramTypes.boolean
        val = evt.currentTarget.checked
      @onParamChange(@paramName, val)
      return

  ParamsView: ParamsView
