module.exports = do ->

  surveyApp = (surveyApp) ->
      survey = surveyApp.survey

      warnings_html = ""
      if surveyApp.warnings and surveyApp.warnings.length > 0
        warnings_html = """<div class="survey-warnings">"""
        for warning in surveyApp.warnings
          warnings_html += """<p class="survey-warnings__warning">#{warning}</p>"""
        warnings_html += """<button class="survey-warnings__close-button js-close-warning">x</button></div>"""

      """
        #{warnings_html}
        <div class="survey-editor form-editor-wrap container">
          <ul class="-form-editor survey-editor__list">
            <li class="survey-editor__null-top-row empty">
              <p class="survey-editor__message well">
                <b>#{t("This form is currently empty.")}</b><br>
                #{t("You can add questions, notes, prompts, or other fields by clicking on the '+' sign below.")}
              </p>
              <div class="survey__row__spacer  expanding-spacer-between-rows expanding-spacer-between-rows--depr">
                <div tabIndex="0" class="btn btn--block btn--addrow js-expand-row-selector">
                  <i class="k-icon k-icon-plus"></i>
                </div>
                <div class="line">&nbsp;</div>
              </div>
            </li>
          </ul>
        </div>
      """

  surveyApp: surveyApp
