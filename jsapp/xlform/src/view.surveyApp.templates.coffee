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
      multiple_questions = surveyApp.features.multipleQuestions
      if multiple_questions
        type_name = "Form"
      else
        type_name = "Question"

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
        <div class="sub-header-bar">
          <div class="container__wide">
            <button class="btn btn--utility survey-editor__action--multiquestion" id="settings"><i class="fa fa-cog"></i> #{_t("Form Settings")}</button>
            <button class="btn btn--utility" id="save"><i class="fa fa-check-circle green"></i> #{_t("Save and Exit")} #{_t(type_name)}</button>
            <button class="btn btn--utility" id="xlf-preview"><i class="fa fa-eye"></i> #{_t("Preview")} #{_t(type_name)}</button>
            <button class="btn btn--utility survey-editor__action--multiquestion js-expand-multioptions--all" ><i class="fa fa-caret-right"></i> #{_t("Show All Responses")}</button>
            <button class="btn btn--utility survey-editor__action--multiquestion btn--group-questions btn--disabled js-group-rows">#{_t("Group Questions")}</button>
          <button class="btn btn--utility pull-right survey-editor__action--multiquestion rowselector_toggle-library" id="question-library"><i class="fa fa-folder"></i> #{_t("Question Library")}</button>
          </div>
        </div>
        <div class="container__fixed">
          <div class="container__wide">
            <div class="form__settings">

              <div class="form__settings__field form__settings__field--form_id">
                <label>#{_t("Form ID")}</label>
                <span class="poshytip" title="#{_t("Unique form name")}">?</span>
                <input type="text">
              </div>

              <div class="form__settings__field form__settings__field--style form__settings__field--appearance">
                <label class="">#{_t("Web form style (Optional)")}</label>
                <span class="poshytip" title="#{_t("This allows using different Enketo styles, e.g. 'theme-grid'")}">?</span>
                <p>
                  <select>
                    <option value="">#{_t("Default - single page")}</option>
                    <option value="theme-grid">#{_t("Grid theme")}</option>
                    <option value="pages">#{_t("Multiple pages")}</option>
                    <option value="theme-grid pages">#{_t("Multiple pages + Grid theme")}</option>
                  </select>
                </p>
              </div>

              <div class="form__settings__field form__settings__field--version">
                <label class="">#{_t("Version (Optional)")}</label>
                <span class="poshytip" title="#{_t("A version ID of the form")}">?</span>
                <input type="text">
              </div>

              <div class="form__settings-meta__questions">
                <h4 class="form__settings-meta__questions-title">#{_t("Hidden meta questions to include in your form to help with analysis")}</h4>
                <div class="stats  row-details settings__first-meta" id="additional-options"></div>
                <h4 class="form__settings-meta__questions-title">#{_t("Meta questions for collecting with cell phones")}</h4>
                <div class="stats  row-details settings__second-meta" id="additional-options"></div>
              </div>

              <div class="form__settings-submission-url bleeding-edge">
                <label class="">Manual submission URL (advanced)</label>
                <span class="poshytip" title="The specific server instance where the data should go to - optional">?</span>
                <div><span class="editable  editable-click">http://kobotoolbox.org/data/longish_username</span></div>
              </div>

              <div class="form__settings-public-key bleeding-edge">
                <label class="">Public Key</label>
                <span class="poshytip" title="The encryption key used for secure forms - optional">?</span>
                <span class="editable  editable-click">12345-232</span>
              </div>

            </div>
          </div>
        </div>
        <header class="survey-header">
          <p class="survey-header__description" hidden>
            <hgroup class="survey-header__inner container">
              <h1 class="survey-header__title">
                <span class="form-title">#{survey.settings.get("form_title") || _t("untitled")}</span>
              </h1>
            </hgroup>
          </p>
          <p>#{translations_content}</p>
        </header>
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
