module.exports = do ->

  xlfRowSelector = {}

  closeRowSelectorButton = """
      <button type="button" class="row__questiontypes__close js-close-row-selector shrink pull-right close close-button close-button--depr" aria-hidden="true">&times;</button>
  """

  xlfRowSelector.line = (name) ->
      """
          <div class="row__questiontypes row-fluid clearfix">
            #{closeRowSelectorButton}
            <input type="text" value="#{name}" class="row__questiontypes__new-question-name js-cancel-sort" dir="auto" />
            <div class="row__questiontypes__list clearfix"></div>
          </div>
      """

  xlfRowSelector.cell = (atts) ->
      """
        <div class="questiontypelist__item" data-menu-item="#{atts.id}">
          <i class="#{atts.iconClassName}"></i>
          #{atts.label}
        </div>
      """

  xlfRowSelector.namer = () ->
    """
      <div class="row__questiontypes row__questiontypes--namer">
        #{closeRowSelectorButton}
        <form class="row__questiontypes__form" action="javascript:void(0);" >
          <input type="text" class="js-cancel-sort mdl-textfield__input" data-cy="textfield_input" dir="auto" />
          <button class="kobo-button kobo-button--storm" data-cy="add_question" >+ #{t("Add Question")}</button>
        </form>
      </div>
    """

  xlfRowSelector
