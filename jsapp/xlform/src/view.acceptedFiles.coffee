Backbone = require 'backbone'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'

module.exports = do ->
  class AcceptedFilesView extends $baseView
    className: 'param-option'
    events: {
      'input input': 'onChange'
    }

    initialize: ({@rowView, @acceptedFiles=''}) -> return

    render: ->
      template = $($viewTemplates.$$render("AcceptedFilesView.input", @acceptedFiles))
      @$el.html(template)
      return @

    insertInDOM: (rowView)->
      @$el.appendTo(rowView.defaultRowDetailParent)
      return

    onChange: (evt) ->
      @acceptedFiles = evt.currentTarget.value
      @rowView.model.setAcceptedFiles(@acceptedFiles)
      @rowView.model.getSurvey().trigger('change')
      return

  AcceptedFilesView: AcceptedFilesView
