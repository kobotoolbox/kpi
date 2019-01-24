_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class MandatorySettingView extends $baseView
    className: 'mandatory-setting'
    events: {
      'input input': 'onChange'
    }

    initialize: ({@rowView, @required={}}) ->
      @$el = $($.parseHTML($viewTemplates.row.mandatorySettingSelector()))
      return

    insertInDOM: (rowView)->
      @$el.appendTo(rowView.defaultRowDetailParent)
      return

    onChange: (evt) ->
      if @paramType is $configs.paramTypes.number
        val = evt.currentTarget.value
      else if @paramType is $configs.paramTypes.boolean
        val = evt.currentTarget.checked
      @onParamChange(@paramName, val)
      return

  MandatorySettingView: MandatorySettingView
