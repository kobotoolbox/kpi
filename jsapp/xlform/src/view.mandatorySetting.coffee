_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class MandatorySettingView extends $baseView
    className: 'mandatory-setting'
    events: {
      'input .js-mandatory-setting-radio': 'onRadioChange'
      'input .js-mandatory-setting-custom-text': 'onCustomTextChange'
    }

    initialize: ({@model}) ->
      console.log('initialize', @model)
      if @model
        @model.on('change', @render, @)
      return

    render: ->
      console.log('render', @)
      template = $($viewTemplates.$$render("row.mandatorySettingSelector", "required_#{@model.cid}", String(@model.attributes.value)))
      @$el.html(template)
      return @

    insertInDOM: (rowView)->
      @$el.appendTo(rowView.defaultRowDetailParent)
      return

    onRadioChange: (evt) ->
      val = evt.currentTarget.value
      console.log('onRadioChange', val)
      @setNewValue(val)
      return

    onCustomTextChange: (evt) ->
      val = evt.currentTarget.value
      console.log('onCustomTextChange', val)
      @setNewValue(val)
      return

    setNewValue: (val) ->
      console.log('setNewValue', val)
      @model.setDetail('required', val)
      return

  MandatorySettingView: MandatorySettingView
