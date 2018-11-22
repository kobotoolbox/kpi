_ = require 'underscore'
Backbone = require 'backbone'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @parameters, @questionType, @paramsConfig})->
      $($.parseHTML $viewTemplates.row.paramsQuestionContent()).insertAfter @rowView.$('.card__header')
      @$el = @rowView.$('.params-view')
      console.log('paramsView init', @questionType, @parameters)

    render: ->
      for paramName, paramType of @paramsConfig
        new ParamOption(paramName, paramType, @parameters[paramName]).render().$el.appendTo(@$el)
      return @

  class ParamOption extends $baseView
    className: "param-option js-cancel-select-row"
    events: {
      "input": "oninput"
      "click .js-clear-option": "onclear"
    }

    initialize: (@paramName, @paramType, @paramValue) ->

    render: ->
      template = $($viewTemplates.$$render("ParamsView.#{@paramType}Param", @paramName, @paramValue))
      @$el.html(template)
      return @

    oninput: (evt) ->
      console.log('oninput', evt)

    clear: () ->
      console.log('clear')

    saveValue: (newValue)->
      console.log('saveValue', newValue)

  ParamsView: ParamsView
