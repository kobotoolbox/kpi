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

    initialize: ({@rowView, @required}) ->
      console.log('initialize', @rowView, @required)
      return

    render: ->
      template = $($viewTemplates.$$render("row.mandatorySettingSelector", "required_#{@required.cid}", String(@required.attributes.value)))
      @$el.html(template)
      @$el.appendTo(@rowView.defaultRowDetailParent)
      return @

    onRadioChange: (evt) ->
      console.log('onRadioChange', evt.currentTarget.value)
      return

    onCustomTextChange: (evt) ->
      console.log('onCustomTextChange', evt.currentTarget.value)
      return

  MandatorySettingView: MandatorySettingView
