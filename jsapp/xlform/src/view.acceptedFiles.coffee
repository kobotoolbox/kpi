import Backbone from 'backbone'
import $baseView from './view.pluggedIn.backboneView'
import $viewTemplates from './view.templates'

export default do ->
  class AcceptedFilesView extends $baseView
    className: 'accepted-files card__settings__fields__field'
    events: {
      'input input': 'onChange'
    }
    placeholder: t("e.g. \".pdf,.doc,.odt\"")

    initialize: ({@rowView, @acceptedFiles=''}) -> return

    render: ->
      template = $($viewTemplates.$$render("AcceptedFilesView.input", @acceptedFiles, @placeholder))
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
