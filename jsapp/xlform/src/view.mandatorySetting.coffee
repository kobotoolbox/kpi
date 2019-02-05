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
      reqVal = @getChangedValue()
      console.log('render', @, reqVal)
      template = $($viewTemplates.$$render("row.mandatorySettingSelector", "required_#{@model.cid}", String(reqVal)))
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

    getChangedValue: ->
      val = @model.getValue()
      changedVal = @model.changed?.required?.attributes?.value
      if typeof changedVal isnt 'undefined'
        return String(changedVal)
      return String(val)

    setNewValue: (val) ->
      console.log('setNewValue', val)
      @model.setDetail('required', val)
      return

  MandatorySettingView: MandatorySettingView
