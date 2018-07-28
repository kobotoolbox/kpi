module.exports = do ->
  _t = require('utils').t

  surveyTemplateApp = () ->
      """
          <button class="btn js-start-survey">#{_t("Start from Scratch")}</button>
          <span class="or">#{_t("or")}</span>
          <hr>
          <form action="/import_survey_draft" class="btn btn--fileupload js-import-fileupload">
            <span class="fileinput-button">
              <span>#{_t("Import XLS")}</span>
              <input type="file" name="files">
            </span>
          </form>
      """

  surveyApp = (surveyApp) ->
      survey = surveyApp.survey

      warnings_html = ""
      if surveyApp.warnings and surveyApp.warnings.length > 0
        warnings_html = """<div class="survey-warnings">"""
        for warning in surveyApp.warnings
          warnings_html += """<p class="survey-warnings__warning">#{warning}</p>"""
        warnings_html += """<button class="survey-warnings__close-button js-close-warning">x</button></div>"""
      if survey.translations
        t0 = survey._translation_1
        t1 = survey._translation_2
        print_translation = (tx)-> if tx is null then "Unnamed translation" else tx
        translations_content = "#{print_translation(t0)}"
        if t1
          translations_content += " [<small>#{print_translation(t1)}</small>]"
      else
        translations_content = ""

      """
        #{warnings_html}
        <div class="survey-editor form-editor-wrap container">
          <ul class="-form-editor survey-editor__list">
            <li class="survey-editor__null-top-row empty">
              <p class="survey-editor__message well">
                <b>#{_t("This form is currently empty.")}</b><br>
                #{_t("You can add questions, notes, prompts, or other fields by clicking on the '+' sign below.")}
              </p>
              <div class="survey__row__spacer  expanding-spacer-between-rows expanding-spacer-between-rows--depr">
                <div class="btn btn--block btn--addrow js-expand-row-selector   add-row-btn add-row-btn--depr">
                  <i class="fa fa-plus"></i>
                </div>
                <div class="line">&nbsp;</div>
              </div>
            </li>
          </ul>
        </div>
      """

  surveyTemplateApp: surveyTemplateApp
  surveyApp: surveyApp
