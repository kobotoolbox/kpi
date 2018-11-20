_ = require 'underscore'
Backbone = require 'backbone'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'
$configs = require './model.configs'

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @parameters})->
      console.log('paramsView init', @rowView, @parameters, $configs.paramTypes)
      @row = @rowView.model
      $($.parseHTML $viewTemplates.row.paramsQuestionContent()).insertAfter @rowView.$('.card__header')
      @$el = @rowView.$('.params-view')

    render: ->
      for param, value in @parameters
        new ParamOption(@attributes.type.attributes.typeId, param, value).render().$el.appendTo(@$el)
      return @

  class ParamOption extends $baseView
    className: "param-option"
    events:
      "input": "oninput"
      "click .js-clear-option": "onclear"

    initialize: (@rowType, @paramName, @paramValue) ->

    render: ->
      @inputEl = $('<input>')
      @container = $('<div>')

      @container.append(@inputEl)

      @$el.html(@d)
      return @

    oninput: (evt) ->
      console.log('oninput', evt)

    clear: () ->
      console.log('clear')

    saveValue: (newValue)->
      console.log('saveValue', newValue)

  ParamsView: ParamsView
