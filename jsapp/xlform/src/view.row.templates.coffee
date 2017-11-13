module.exports = do ->
  _t = require('utils').t
  replaceSupportEmail = require('utils').replaceSupportEmail

  expandingSpacerHtml = """
      <div class="survey__row__spacer  row clearfix expanding-spacer-between-rows expanding-spacer-between-rows--depr">
        <div class="js-expand-row-selector btn btn--addrow btn--block  btn-xs  btn-default  add-row-btn"
            ><i class="fa fa-plus"></i></div>
        <div class="line">&nbsp;</div>
      </div>
  """

  groupSettingsView = ->
    """
      <section class="card__settings  row-extras row-extras--depr">
        <i class="card__settings-close fa fa-times js-toggle-card-settings"></i>
        <ul class="card__settings__tabs">
          <li class="heading"><i class="fa fa-cog"></i> #{_t("Settings")}</li>
          <li data-card-settings-tab-id="all" class="card__settings__tabs__tab--active">#{_t("All group settings")}</li>
          <li data-card-settings-tab-id="skip-logic" class="">#{_t("Skip Logic")}</li>
        </ul>
        <div class="card__settings__content">
          <div class="card__settings__fields card__settings__fields--active card__settings__fields--all">
          </div>
          <div class="card__settings__fields card__settings__fields--skip-logic"></div>
        </div>
      </section>
    """
  rowSettingsView = ()->
    """
      <section class="card__settings  row-extras row-extras--depr">
        <i class="card__settings-close fa fa-times js-toggle-card-settings"></i>
        <ul class="card__settings__tabs">
          <li class="heading"><i class="fa fa-cog"></i> #{_t("Settings")}</li>
          <li data-card-settings-tab-id="question-options" class="card__settings__tabs__tab--active">#{_t("Question Options")}</li>
          <li data-card-settings-tab-id="skip-logic" class="">#{_t("Skip Logic")}</li>
          <li data-card-settings-tab-id="validation-criteria" class="">#{_t("Validation Criteria")}</li>
          <li data-card-settings-tab-id="response-type" class="card__settings__tab--response-type">#{_t("Response Type")}</li>
        </ul>
        <div class="card__settings__content">
          <ul class="card__settings__fields card__settings__fields--active card__settings__fields--question-options">
          </ul>

          <ul class="card__settings__fields card__settings__fields--skip-logic">
          </ul>

          <ul class="card__settings__fields card__settings__fields--validation-criteria">
          </ul>

          <ul class="card__settings__fields card__settings__fields--response-type">
          </ul>
        </div>
      </section>
    """

  xlfRowView = (surveyView) ->
      template = """
      <div class="survey__row__item survey__row__item--question card js-select-row">
        <div class="card__header">
          <div class="card__header--shade"><span></span></div>
          <div class="card__indicator">
            <div class="noop card__indicator__icon"><i class="fa fa-fw card__header-icon"></i></div>
          </div>
          <div class="card__text">
            <span class="card__header-title js-cancel-select-row js-cancel-sort"></span>
            <p class="card__header-subtitle js-cancel-select-row js-cancel-sort" style="display:none"></p>
          </div>
          <div class="card__buttons">
            <span class="card__buttons__button card__buttons__button--settings card__buttons__button--gray js-toggle-card-settings" data-button-name="settings"><i class="fa fa-cog"></i></span>
            <span class="card__buttons__button card__buttons__button--delete card__buttons__button--red js-delete-row" data-button-name="delete"><i class="fa fa-trash-o"></i></span>
      """
      if surveyView.features.multipleQuestions
        template += """<span class="card__buttons__button card__buttons__button--copy card__buttons__button--blue js-clone-question" data-button-name="duplicate"><i class="fa fa-copy"></i></span>
                  <span class="card__buttons__button card__buttons__button--add card__buttons__button--gray-green js-add-to-question-library" data-button-name="add-to-library"><i class="fa fa-folder-o"><i class="fa fa-plus"></i></i></span>"""

      return template + """
          </div>
        </div>
      </div>
      #{expandingSpacerHtml}
      """

  groupView = (g)->
    """
    <div class="survey__row__item survey__row__item--group group card js-select-row">
      <header class="group__header">
        <i class="group__caret js-toggle-group-expansion fa fa-fw fa-caret-down"></i>
        <span class="group__label js-cancel-select-row js-cancel-sort">#{g.getValue('label')}</span>
          <div class="group__header__buttons">
            <span class="group__header__buttons__button group__header__buttons__button--settings js-toggle-card-settings"><i class="fa fa-cog"></i></span>
            <span class="group__header__buttons__button group__header__buttons__button--delete js-delete-group"><i class="fa fa-trash-o"></i></span>
          </div>
      </header>
      <ul class="group__rows">
      </ul>
    </div>
    #{expandingSpacerHtml}
    """

  koboMatrixView = () ->
      template = """
      <div class="survey__row__item survey__row__item--question card js-select-row">
        <div class="card__header">
          <div class="card__header--shade"><span></span></div>
          <div class="card__indicator">
            <div class="noop card__indicator__icon"><i class="fa fa-fw card__header-icon fa-table"></i></div>
          </div>
          <div class="card__text">
            <span class="card__header-title js-cancel-select-row js-cancel-sort"></span>
            <p class="card__header-subtitle js-cancel-select-row js-cancel-sort" style="display:none"></p>
          </div>
          <div class="card__buttons">
            <span class="card__buttons__button card__buttons__button--settings card__buttons__button--gray js-toggle-card-settings" data-button-name="settings"><i class="fa fa-cog"></i></span>
            <span class="card__buttons__button card__buttons__button--delete card__buttons__button--red js-delete-row" data-button-name="delete"><i class="fa fa-trash-o"></i></span>
          </div>
        </div>
        <p class="kobomatrix-warning">#{_t("Note: The Matrix question type only works in Enketo web forms using the 'grid' style.")}</p>

        <div class="card__kobomatrix">
      """
      return template + """
        </div>
      </div>
      #{expandingSpacerHtml}
      """

  scoreView = (template_args={})->
    fillers = []
    cols = []
    for col in template_args.score_choices
      fillers.push """<td class="scorecell__radio"><input type="radio" disabled="disabled"></td>"""
      autoname_class = ""
      autoname_attr = ""
      if col.autoname
        autoname_class = "scorecell__name--automatic"
        autoname_attr = """data-automatic-name="#{col.autoname}" """
      namecell = """
        <p class="scorecell__name #{autoname_class}" #{autoname_attr} contenteditable="true" title="Option value">#{col.name or ''}</p>
      """
      cols.push """
        <th class="scorecell__col" data-cid="#{col.cid}">
          <span class="scorecell__label" contenteditable="true">#{col.label}</span><button class="scorecell__delete js-delete-scorecol">&times;</button>
          #{namecell}
        </th>
        """
    thead_html = cols.join('')
    fillers = fillers.join('')
    tbody_html = for row in template_args.score_rows
      autoname_attr = ""
      autoname_class = ""
      if row.autoname
        autoname_class = "scorelabel__name--automatic"
        autoname_attr = """data-automatic-name="#{row.autoname}" """

      scorelabel__name = """
        <span class="scorelabel__name #{autoname_class}" #{autoname_attr} contenteditable="true" title="#{_t("Row name")}">#{row.name or ''}</span>
      """

      """
      <tr data-row-cid="#{row.cid}">
        <td class="scorelabel">
          <span class="scorelabel__edit" contenteditable="true">#{row.label}</span>
          <button class="scorerow__delete js-delete-scorerow">&times;</button>
          <br>
          #{scorelabel__name}
        </td>
        #{fillers}
      </tr>
      """
    table_html = """
    <table class="score_preview__table">
      <thead>
        <th class="scorecell--empty"></th>
        #{thead_html}
        <th class="scorecell--add"><span>+</span></th>
      </thead>
      <tbody>
        #{tbody_html.join('')}
      </tbody>
      <tfoot>
        <tr>
        <td class="scorerow--add"><button>+</button></td>
        </tr>
      </tfoot>
    </table>
    """
    """
    <div class="score_preview">
      #{table_html}
    </div>
    """
  rankView = (s, template_args={})->
    rank_levels_lis = for item in template_args.rank_levels
      autoclass = ""
      autoattr = ""
      autoattr = """data-automatic-name="#{item.automatic}" """
      if item.set_automatic
        autoclass = "rank_items__name--automatic"
      """
      <li class="rank_items__level" data-cid="#{item.cid}">
        <span class="rank_items__level__label">#{item.label}</span><button class="rankcell__delete js-delete-rankcell">&times;</button>
        <br>
        <span class="rank_items__name #{autoclass}" #{autoattr}>#{item.name or ''}</span>
      </li>
      """
    rank_rows_lis = for item in template_args.rank_rows
      autoclass = ""
      autoattr = ""
      autoattr = """data-automatic-name="#{item.automatic}" """
      if item.set_automatic
        autoclass = "rank_items__name--automatic"
      """
      <li class="rank_items__item" data-cid="#{item.cid}">
        <span class="rank_items__item__label">#{item.label}</span><button class="rankcell__delete js-delete-rankcell">&times;</button>
        <br>
        <span class="rank_items__name #{autoclass}" #{autoattr}>#{item.name or ''}</span>
      </li>
      """
    rank_constraint_message_html = """
    <li class="rank_items__constraint_wrap">
      <p class="rank_items__constraint_explanation">
        #{_t("A constraint message to be read in case of error:")}
      </p>
      <p class="rank_items__constraint_message">
        #{template_args.rank_constraint_msg}
      </p>
    </li>
    """

    rank_constraint_message_li = """
      #{rank_constraint_message_html}
    """
    """
    <div class="rank_preview clearfix">
      <ol class="rank__rows">
        #{rank_rows_lis.join('')}
        <li class="rank_items__add rank_items__add--item"><button>+</button></li>
      </ol>
      <ul class="rank__levels">
        #{rank_levels_lis.join('')}
        <li class="rank_items__add rank_items__add--level"><button>+</button></li>
        #{rank_constraint_message_li}
      </ul>
    </div>
    """


  selectQuestionExpansion = ->
    """
    <div class="card--selectquestion__expansion row__multioptions js-cancel-sort">
      <div class="list-view">
        <ul></ul>
      </div>
    </div>
    """

  expandChoiceList = ()->
    """
    <span class="card__buttons__multioptions js-toggle-row-multioptions js-cancel-select-row"><i class='right-and-down-caret' /></span>
    """

  rowErrorView = (atts)->
    """
    <div class="card card--error">
      #{_t("Row could not be displayed:")} <pre>#{atts}</pre>
      <em>#{replaceSupportEmail(_t("This question could not be imported. Please re-create it manually. Please contact us at support@kobotoolbox.org so we can fix this bug!"))}</em>
    </div>
    #{expandingSpacerHtml}
    """

  xlfRowView: xlfRowView
  expandChoiceList: expandChoiceList
  selectQuestionExpansion: selectQuestionExpansion
  groupView: groupView
  rowErrorView: rowErrorView
  koboMatrixView: koboMatrixView
  scoreView: scoreView
  rankView: rankView
  groupSettingsView: groupSettingsView
  rowSettingsView: rowSettingsView
