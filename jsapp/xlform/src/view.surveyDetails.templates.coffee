define 'cs!xlform/view.surveyDetails.templates', [], ()->
  xlfSurveyDetailView = (model) ->
    """
    <label title="#{model.get("description") || ''}">
      <input type="checkbox">
      #{model.get("label")}
    </label>
    """

  xlfSurveyDetailView: xlfSurveyDetailView
