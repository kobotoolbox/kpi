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
      return @

  ParamsView: ParamsView
