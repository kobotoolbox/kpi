_ = require 'underscore'
Backbone = require 'backbone'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class ParamsView extends $baseView
    initialize: ({@rowView, @model})->
      @list = @model
      @row = @rowView.model
      $($.parseHTML $viewTemplates.row.paramsQuestionContent()).insertAfter @rowView.$('.card__header')
      @$el = @rowView.$(".params-view")

    render: ->
      return @

  ParamsView: ParamsView
