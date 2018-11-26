_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @parameters={}, @paramsConfig}) ->
      $().insertAfter @rowView.$('.card__header')
      @$el = $($.parseHTML($viewTemplates.row.paramsSettingsField()))
      @$paramsViewEl = @$el.find('.params-view')
      return

    render: ->
      for paramName, paramType of @paramsConfig
        new ParamOption(
          paramName,
          paramType,
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
    className: 'param-option js-cancel-select-row'
    events: {
      'input input': 'onChange'
    }

    initialize: (@paramName, @paramType, @paramValue='', @onParamChange) -> return

    render: ->
      template = $($viewTemplates.$$render("ParamsView.#{@paramType}Param", @paramName, @paramValue))
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
