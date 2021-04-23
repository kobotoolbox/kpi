###
This is the view for the survey-wide details that appear at the bottom
of the survey. Examples: "imei", "start", "end"
###

Backbone = require 'backbone'
$viewTemplates = require './view.templates'

module.exports = do ->
  class SurveyDetailView extends Backbone.View
    className: "survey-header__option"
    events:
      "change input": "changeChkValue"
    initialize: ({@model})->
    render: ()->
      @$el.append $viewTemplates.$$render 'xlfSurveyDetailView', @model
      @chk = @$el.find("input")
      @chk.prop "checked", true  if @model.get "value"
      @changeChkValue()
      @
    changeChkValue: ()->
      if @chk.prop("checked")
        @$el.addClass("active")
        @model.set("value", true)
      else
        @$el.removeClass("active")
        @model.set("value", false)
    constructor: (options) ->
      super(options)
      @selector = options.selector
    attach_to: (destination) ->
      destination.find(@selector).append @el

  SurveyDetailView: SurveyDetailView
