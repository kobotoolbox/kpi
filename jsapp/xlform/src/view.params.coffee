_ = require 'underscore'
Backbone = require 'backbone'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'
$configs = require './model.configs'

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @parameters})->
      @questionType = @rowView.model.attributes.type.attributes.typeId
      $($.parseHTML $viewTemplates.row.paramsQuestionContent()).insertAfter @rowView.$('.card__header')
      @$el = @rowView.$('.params-view')
      console.log('paramsView init', @questionType, @parameters)

    render: ->
      for param, value of @parameters
        console.log(new ParamOption(@questionType, param, value).render())
        new ParamOption(@questionType, param, value).render().$el.appendTo(@$el)
      return @

  class ParamOption extends $baseView
    className: "param-option js-cancel-select-row"
    events: {
      "input": "oninput"
      "click .js-clear-option": "onclear"
    }

    initialize: (@questionType, @paramName, @paramValue) ->

    render: ->
      templateName = $configs.paramTypes[@questionType][@paramName] + 'Param'
      template = $($viewTemplates.$$render("ParamsView.#{templateName}", @paramName, @paramValue))
      @$el.html(template)
      return @

    oninput: (evt) ->
      console.log('oninput', evt)

    clear: () ->
      console.log('clear')

    saveValue: (newValue)->
      console.log('saveValue', newValue)

  ParamsView: ParamsView
