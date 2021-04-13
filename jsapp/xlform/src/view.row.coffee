_ = require 'underscore'
Backbone = require 'backbone'
$configs = require './model.configs'
$rowSelector = require './view.rowSelector'
$row = require './model.row'
$modelUtils = require './model.utils'
$viewTemplates = require './view.templates'
$viewUtils = require './view.utils'
$viewChoices = require './view.choices'
$viewParams = require './view.params'
$viewMandatorySetting = require './view.mandatorySetting'
$acceptedFilesView = require './view.acceptedFiles'
$viewRowDetail = require './view.rowDetail'
renderKobomatrix = require('js/formbuild/renderInBackbone').renderKobomatrix
alertify = require 'alertifyjs'
hasRowRestriction = require('js/components/locking/lockingUtils').hasRowRestriction
getRowLockingProfile = require('js/components/locking/lockingUtils').getRowLockingProfile
isRowLocked = require('js/components/locking/lockingUtils').isRowLocked
isAssetLockable = require('js/components/locking/lockingUtils').isAssetLockable
isAssetAllLocked = require('js/components/locking/lockingUtils').isAssetAllLocked
getQuestionFeatures = require('js/components/locking/lockingUtils').getQuestionFeatures
getGroupFeatures = require('js/components/locking/lockingUtils').getGroupFeatures
LOCKING_RESTRICTIONS = require('js/components/locking/lockingConstants').LOCKING_RESTRICTIONS
LOCKING_UI_CLASSNAMES = require('js/components/locking/lockingConstants').LOCKING_UI_CLASSNAMES
$icons = require './view.icons'

module.exports = do ->
  class BaseRowView extends Backbone.View
    tagName: "li"
    className: "survey__row  xlf-row-view xlf-row-view--depr"
    events:
      "drop": "drop"

    initialize: (opts)->
      @options = opts
      typeDetail = @model.get("type")
      @$el.attr("data-row-id", @model.cid)
      @ngScope = opts.ngScope
      @surveyView = @options.surveyView
      @model.on "detail-change", (key, value, ctxt)=>
        customEventName = $viewUtils.normalizeEventName("row-detail-change-#{key}")
        @$(".on-#{customEventName}").trigger(customEventName, key, value, ctxt)
      return

    drop: (evt, index)->
      @$el.trigger("update-sort", [@model, index])

    getApp: ->
      @surveyView.getApp()

    getRawType: ->
      return @model.get('type').get('typeId')

    ###
    # This needs to be safeguarded so much, as there is possibility row doesn't
    # have a `name` or doesn't have anything (e.g. newly created row)
    ###
    getRowName: ->
      modelName = @model.get('name')
      modelAutoname = @model.get('$autoname')
      if modelName and modelName.get('value')
        return modelName.get('value')
      else if modelAutoname and modelAutoname.get('value')
        return modelAutoname.get('value')
      else
        return null

    hasRestriction: (restrictionName) ->
      return hasRowRestriction(@ngScope.rawSurvey, @getRowName(), restrictionName)

    isLockable: ->
      return isAssetLockable(@ngScope.assetType?.id)

    render: (opts={})->
      fixScroll = opts.fixScroll

      if @already_rendered
        return

      if fixScroll
        @$el.height(@$el.height())

      @already_rendered = true

      if @model instanceof $row.RowError
        @_renderError()
      else
        @_renderRow()
      @is_expanded = @$card?.hasClass('card--expandedchoices')

      if fixScroll
        @$el.attr('style', '')

      return @

    _renderError: ->
      @$el.addClass("xlf-row-view-error")
      atts = $viewUtils.cleanStringify(@model.toJSON())
      @$el.html $viewTemplates.$$render('row.rowErrorView', atts)
      return @

    _renderRow: ->
      @$el.html $viewTemplates.$$render('row.xlfRowView', @surveyView)

      @$card = @$el.find('> .card').eq(0)
      @$header = @$card.find('> .card__header').eq(0)
      @$label = @$header.find('.js-card-label').eq(0)
      @$hint = @$header.find('.js-card-hint').eq(0)

      context = {warnings: []}

      questionType = @getRawType()
      if (
        $configs.questionParams[questionType] and
        'getParameters' of @model and
        questionType is 'range'
      )
        @paramsView = new $viewParams.ParamsView({
          rowView: @,
          parameters: @model.getParameters(),
          questionType: questionType
        }).render().insertInDOMAfter(@$header)

      if questionType is 'calculate' or questionType is 'hidden'
        @$hint.hide()

      if 'getList' of @model and (cl = @model.getList())
        @$card.addClass('card--selectquestion card--expandedchoices')
        @is_expanded = true
        isSortableDisabled = (
          @isLockable() and
          @hasRestriction(LOCKING_RESTRICTIONS.choice_order_edit.name)
        )
        @listView = new $viewChoices.ListView(model: cl, rowView: @).render(isSortableDisabled)

      @cardSettingsWrap = @$('.card__settings').eq(0)
      @defaultRowDetailParent = @cardSettingsWrap.find('.js-card-settings-row-options').eq(0)
      for [key, val] in @model.attributesArray() when key in ['label', 'hint', 'type']
        view = new $viewRowDetail.DetailView(model: val, rowView: @)
        if key == 'label' and @getRawType() == 'calculate'
          view.model = @model.get('calculation')
          @model.finalize()
          val.set('value', '')
        view.render().insertInDOM(@)
      if @model.getValue('required')
        @$card.addClass('card--required')

      return @

    toggleSettings: (show)->
      if show is undefined
        show = !@_settingsExpanded

      if show and !@_settingsExpanded
        @_expandedRender()
        @$card.addClass('card--expanded-settings')
        @hideMultioptions?()
        @_settingsExpanded = true
        # rerender locking (if applies to class extending BaseRowView)
        if @applyLocking
          @applyLocking()
      else if !show and @_settingsExpanded
        @$card.removeClass('card--expanded-settings')
        @_cleanupExpandedRender()
        @_settingsExpanded = false
      ``

    _cleanupExpandedRender: ->
      @$('.card__settings').detach()

    clone: (event) =>
      parent = @model._parent
      model = @model
      if @model.get('type').get('typeId') in ['select_one', 'select_multiple']
        model = @model.clone()
      else if @model.get('type').get('typeId') in ['rank', 'score']
        model = @model.clone()

      @model.getSurvey().insert_row.call parent._parent, model, parent.models.indexOf(@model) + 1

    add_row_to_question_library: (evt) =>
      evt.stopPropagation()
      @ngScope?.add_row_to_question_library @model, @model.getSurvey()._initialParams

  class GroupView extends BaseRowView
    className: "survey__row survey__row--group  xlf-row-view xlf-row-view--depr"

    initialize: (opts)->
      @options = opts
      @ngScope = opts.ngScope
      @_shrunk = !!opts.shrunk
      @$el.attr("data-row-id", @model.cid)
      @surveyView = @options.surveyView

      # reapply locking after changes, so e.g. added option gets all locking
      @model.getSurvey()?.on("change", () => @applyLocking() )
      # reapply locking after group sortable is initialized, as there is no
      # simple way to prevent the sortable from being created, we go around it
      # in a creative BAD CODE™ way
      @model.getSurvey()?.on("group-sortable-created", () => @applyLocking() )

      return

    deleteGroup: (evt)=>
      skipConfirm = $(evt.currentTarget).hasClass('js-force-delete-group')
      if skipConfirm or confirm(t("Are you sure you want to split apart this group?"))
        @_deleteGroup()
      evt.preventDefault()

    _deleteGroup: () =>
      @model.splitApart()
      @model._parent._parent.trigger('remove', @model)
      @surveyView.survey.trigger('change')
      @$el.detach()

    render: ->
      if !@already_rendered
        @$el.html $viewTemplates.row.groupView(@model)
        @$card = @$el.find('> .card').eq(0)
        @$rows = @$card.find('> .group__rows').eq(0)
        @$header = @$card.find('> .card__header, > .group__header').eq(0)
        @$label = @$header.find('.js-card-label').eq(0)

      @model.rows.each (row)=>
        @getApp().ensureElInView(row, @, @$rows).render()

      if !@already_rendered
        # only render the row details which are necessary for the initial view (ie 'label')
        view = new $viewRowDetail.DetailView(model: @model.get('label'), rowView: @)
        view.render().insertInDOM(@)

      @already_rendered = true

      @applyLocking()

      return @

    ###
    # Locking function for groups.
    #
    # Makes sure the locking restrictions are applied propery, i.e. some should
    # be applied only to this group and not to child groups, but others should
    # go all levels deep
    ###
    applyLocking: ->
      rowName = @getRowName()

      # no point of checking locking for nameless row
      if rowName is null
        return

      @$settings = @$card.find('> .card__settings').eq(0)
      isLockable = @isLockable()

      if (isRowLocked(@ngScope.rawSurvey, rowName))
        # build Locked Features settings tab
        if (isRowLocked(@ngScope.rawSurvey, rowName))
          @$settings.find('*[data-card-settings-tab-id="locked-features"]').removeClass(LOCKING_UI_CLASSNAMES.HIDDEN)
          @$lockedFeaturesContent = @$settings.find('.js-card-settings-locked-features');
          @$lockedFeaturesContent.removeClass(LOCKING_UI_CLASSNAMES.HIDDEN)
          lockedFeatures = $($viewTemplates.row.lockedFeatures(
            getGroupFeatures(@ngScope.rawSurvey, rowName)
          ))
          @$lockedFeaturesContent.html(lockedFeatures)

        # add icon with tooltip
        $groupIcon = @$header.find('.js-group-icon')
        $groupIcon.find('.k-icon').addClass('k-icon-lock-alt')

        if not $groupIcon.hasClass('k-tooltip__parent')
          $groupIcon.addClass('k-tooltip__parent')

          isAllLocked = isAssetAllLocked(@ngScope.rawSurvey)

          profileName = t('Locked')
          if !isAllLocked
            profileName = getRowLockingProfile(@ngScope.rawSurvey, rowName)?.name

          tooltipMsg = t('fully locked group')
          if !isAllLocked
            tooltipMsg = t('partially locked group')

          iconTooltip = $($viewTemplates.row.iconTooltip(profileName, tooltipMsg))
          $groupIcon.append(iconTooltip)

      # hide group delete button
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_delete.name))
        @$header.find('.js-delete-group').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)

      # disable group name label
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_label_edit.name))
        @$label.addClass(LOCKING_UI_CLASSNAMES.DISABLED)

      # hide all add and clone buttons for questions inside the group
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_question_add.name))
        @$el.find('.js-add-row-button').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)
        @$el.find('.js-clone-question').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)

      # hide all child and sub-child question's delete button
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_question_delete.name))
        @$el.find('.js-delete-row').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)

      # disable reordering all children in the group: questions and groups and
      # their children, don't apply to question options though
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_question_order_edit.name))
        @$card.find('.group__rows.ui-sortable').sortable('disable')
        @$card.find('.group__rows.ui-sortable').removeClass('js-sortable-enabled')

      # disable all UI from "Settings" tab of group settings
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_settings_edit.name))
        @$settings.find('.js-card-settings-row-options').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

      # disable all UI from "Skip Logic" tab of group settings
      if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.group_skip_logic_edit.name))
        @$settings.find('.js-card-settings-skip-logic').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

      return

    hasNestedGroups: ->
      return _.filter(@model.rows.models, (row) -> row.constructor.key == 'group').length > 0

    _expandedRender: ->
      @$header.after($viewTemplates.row.groupSettingsView())
      @cardSettingsWrap = @$('.card__settings').eq(0)
      @defaultRowDetailParent = @cardSettingsWrap.find('.card__settings__fields--active').eq(0)
      for [key, val] in @model.attributesArray()
        if key in ["name", "_isRepeat", "appearance", "relevant"] or key.match(/^.+::.+/)
          new $viewRowDetail.DetailView(model: val, rowView: @).render().insertInDOM(@)

      @model.on 'add', (row) =>
        if row.constructor.key == 'group'
          $appearanceField = @$('.xlf-dv-appearance').eq(0)
          $appearanceField.hide()
          $appearanceField.find('input:checkbox').prop('checked', false)
          appearanceModel = @model.get('appearance')
          if appearanceModel.getValue()
            alertify.warning(t("You can't display nested groups on the same screen - the setting has been removed from the parent group"))
          appearanceModel.set('value', '')

      @model.on 'remove', (row) =>
        if row.constructor.key == 'group' && !@hasNestedGroups()
          @$('.xlf-dv-appearance').eq(0).show()

      @applyLocking()

      return @

  class RowView extends BaseRowView
    initialize: (opts) ->
      super(opts)
      # reapply locking after changes, so e.g. added option gets all locking
      @model.getSurvey()?.on("change", () => @applyLocking() )
      return

    _renderRow: ->
      super()
      @applyLocking()
      return @

    _expandedRender: ->
      @$header.after($viewTemplates.row.rowSettingsView())
      @cardSettingsWrap = @$('.card__settings').eq(0)
      @defaultRowDetailParent = @cardSettingsWrap.find('.js-card-settings-row-options').eq(0)

      # don't display columns that start with a $
      hiddenFields = ['label', 'hint', 'type', 'select_from_list_name', 'kobo--matrix_list', 'parameters']
      for [key, val] in @model.attributesArray() when !key.match(/^\$/) and key not in hiddenFields
        if key is 'required'
          @mandatorySetting = new $viewMandatorySetting.MandatorySettingView({
            model: @model.get('required')
          }).render().insertInDOM(@)
        else if key is '_isRepeat' and @model.getValue('type') is 'kobomatrix'
          # don't display repeat checkbox for matrix groups
          continue
        else
          new $viewRowDetail.DetailView(model: val, rowView: @).render().insertInDOM(@)

      questionType = @model.get('type').get('typeId')
      if (
        $configs.questionParams[questionType] and
        'getParameters' of @model and
        questionType isnt 'range'
      )
        @paramsView = new $viewParams.ParamsView({
          rowView: @,
          parameters: @model.getParameters(),
          questionType: questionType
        }).render().insertInDOM(@)

      if questionType is 'file'
        @acceptedFilesView = new $acceptedFilesView.AcceptedFilesView({
          rowView: @,
          acceptedFiles: @model.getAcceptedFiles()
        }).render().insertInDOM(@)

      @applyLocking()

      return @

    ###
    # Locking function for questions.
    #
    # This needs be run at the end of rendering, also re-run each time some new
    # nodes are created.
    ###
    applyLocking: () ->
      rowName = @getRowName()

      # no point of checking locking for nameless row
      if rowName is null
        return

      @$settings = @$card.find('> .card__settings')
      isLockable = @isLockable()

      if (isRowLocked(@ngScope.rawSurvey, rowName))
        isAllLocked = isAssetAllLocked(@ngScope.rawSurvey)

        # set visual styles for given locking profile
        profileDef = getRowLockingProfile(@ngScope.rawSurvey, rowName)
        if (isAllLocked)
          @$el.addClass('locking__level-all')
        else if (profileDef and profileDef.index is 0)
          @$el.addClass('locking__level-1')
        else if (profileDef and profileDef.index is 1)
          @$el.addClass('locking__level-2')
        else if (profileDef and profileDef.index >= 2)
          @$el.addClass('locking__level-3-plus')

        # build Locked Features settings tab
        @$settings.find('*[data-card-settings-tab-id="locked-features"]').removeClass(LOCKING_UI_CLASSNAMES.HIDDEN)
        @$lockedFeaturesContent = @$settings.find('.js-card-settings-locked-features');
        @$lockedFeaturesContent.removeClass(LOCKING_UI_CLASSNAMES.HIDDEN)
        lockedFeatures = $($viewTemplates.row.lockedFeatures(
          getQuestionFeatures(@ngScope.rawSurvey, rowName)
        ))
        @$lockedFeaturesContent.html(lockedFeatures)

        # change row type icon to locked version
        iconDef = $icons.get(@getRawType())
        if (iconDef)
          $indicatorIcon = @$header.find('.card__indicator__icon')
          $indicatorIcon.find('.card__header-icon').removeClass(iconDef.get("iconClassName"))
          $indicatorIcon.find('.card__header-icon').addClass(iconDef.get("iconClassNameLocked"))

          # add tooltip
          if not $indicatorIcon.hasClass('k-tooltip__parent')
            profileName = t('Locked')
            if !isAllLocked
              profileName = getRowLockingProfile(@ngScope.rawSurvey, rowName)?.name

            tooltipMsg = t('fully locked question')
            if !isAllLocked
              tooltipMsg = t('partially locked question')

            $indicatorIcon.addClass('k-tooltip__parent')
            iconTooltip = $($viewTemplates.row.iconTooltip(profileName, tooltipMsg))
            $indicatorIcon.append(iconTooltip)

        # disable adding new question options
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.choice_add.name))
          @$el.find('.js-card-add-options').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

        # disable removing question options
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.choice_delete.name))
          @$el.find('.js-remove-option').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

        # disable changing question options labels and names
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.choice_edit.name))
          @$el.find('.js-option-label-input').addClass(LOCKING_UI_CLASSNAMES.DISABLED)
          @$el.find('.js-option-name-input').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

        # hide delete question button
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.question_delete.name))
          @$header.find('.js-delete-row').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)

        # disable editing question label and hint
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.question_label_edit.name))
          if @$label
            @$label.addClass(LOCKING_UI_CLASSNAMES.DISABLED)
          if @$hint
            @$hint.addClass(LOCKING_UI_CLASSNAMES.DISABLED)

        # disable all UI from "Settings" tab of question settings and Params View (if applicable)
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.question_settings_edit.name))
          @$settings.find('.js-card-settings-row-options').addClass(LOCKING_UI_CLASSNAMES.DISABLED)
          @$settings.find('.js-params-view').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

        # disable all UI from "Skip Logic" tab of question settings
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.question_skip_logic_edit.name))
          @$settings.find('.js-card-settings-skip-logic').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

        # disable all UI from "Validation Criteria" tab of question settings
        if (isLockable and @hasRestriction(LOCKING_RESTRICTIONS.question_validation_edit.name))
          @$settings.find('.js-card-settings-validation-criteria').addClass(LOCKING_UI_CLASSNAMES.DISABLED)

      return

    hideMultioptions: ->
      @$card.removeClass('card--expandedchoices')
      @is_expanded = false
      return

    showMultioptions: ->
      @$card.addClass('card--expandedchoices')
      @$card.removeClass('card--expanded-settings')
      @toggleSettings(false)
      return

    toggleMultioptions: ->
      if @is_expanded
        @hideMultioptions()
      else
        @showMultioptions()
        @is_expanded = true
      return

  class KoboMatrixView extends RowView
    className: "survey__row survey__row--kobo-matrix"

    _expandedRender: ->
      super()
      @$('.xlf-dv-required').hide()
      @$("li[data-card-settings-tab-id='validation-criteria']").hide()
      @$("li[data-card-settings-tab-id='skip-logic']").hide()

    _renderRow: ->
      @$el.html $viewTemplates.row.koboMatrixView()
      @matrix = @$('.card__kobomatrix')
      renderKobomatrix(@, @matrix)
      @$label = @$('.js-card-label').eq(0)
      @$card = @$('.card').eq(0)
      @$header = @$('.card__header').eq(0)
      context = {warnings: []}

      for [key, val] in @model.attributesArray() when key is 'label' or key is 'type'
        view = new $viewRowDetail.DetailView(model: val, rowView: @)
        if key == 'label' and @model.get('type').get('value') == 'calculate'
          view.model = @model.get('calculation')
          @model.finalize()
          val.set('value', '')
        view.render().insertInDOM(@)
      return @

  class RankScoreView extends RowView
    _expandedRender: ->
      super()
      @$('.xlf-dv-required').hide()
      @$("li[data-card-settings-tab-id='validation-criteria']").hide()

  class ScoreView extends RankScoreView
    className: "survey__row survey__row--score"
    _renderRow: (args...)->
      super(args)
      while @model._scoreChoices.options.length < 2
        @model._scoreChoices.options.add(label: 'Option')
      score_choices = for sc in @model._scoreChoices.options.models
        autoname = ''
        if sc.get('name') in [undefined, '']
          autoname = $modelUtils.sluggify(sc.get('label'))

        label: sc.get('label')
        name: sc.get('name')
        autoname: autoname
        cid: sc.cid

      if @model._scoreRows.length < 1
        @model._scoreRows.add
          label: t("Enter your question")
          name: ''

      score_rows = for sr in @model._scoreRows.models
        if sr.get('name') in [undefined, '']
          autoname = $modelUtils.sluggify(sr.get('label'), validXmlTag: true)
        else
          autoname = ''
        label: sr.get('label')
        name: sr.get('name')
        autoname: autoname
        cid: sr.cid

      template_args = {
        score_rows: score_rows
        score_choices: score_choices
      }

      extra_score_contents = $viewTemplates.$$render('row.scoreView', template_args)
      @$('.card--selectquestion__expansion').eq(0).append(extra_score_contents).addClass('js-cancel-select-row')
      $rows = @$('.score__contents--rows').eq(0)
      $choices = @$('.score__contents--choices').eq(0)

      $el = @$el
      offOn = (evtName, selector, callback)->
        $el.off(evtName).on(evtName, selector, callback)

      get_row = (cid)=> @model._scoreRows.get(cid)
      get_choice = (cid)=> @model._scoreChoices.options.get(cid)
      offOn 'click.deletescorerow', '.js-delete-scorerow', (evt)=>
        $et = $(evt.target)
        row_cid = $et.closest('tr').eq(0).data('row-cid')
        @model._scoreRows.remove(get_row(row_cid))
        @already_rendered = false
        @render(fixScroll: true)
      offOn 'click.deletescorecol', '.js-delete-scorecol', (evt)=>
        $et = $(evt.target)
        @model._scoreChoices.options.remove(get_choice($et.closest('th').data('cid')))
        @already_rendered = false
        @render(fixScroll: true)

      offOn 'input.editscorelabel', '.scorelabel__edit', (evt)->
        $et = $(evt.target)
        row_cid = $et.closest('tr').eq(0).data('row-cid')
        get_row(row_cid).set('label', $et.text())

      offOn 'input.namechange', '.scorelabel__name', (evt)=>
        $ect = $(evt.currentTarget)
        row_cid = $ect.closest('tr').eq(0).data('row-cid')
        _inpText = $ect.text()
        _text = $modelUtils.sluggify(_inpText, validXmlTag: true)
        get_row(row_cid).set('name', _text)

        if _text is ''
          $ect.addClass('scorelabel__name--automatic')
        else
          $ect.removeClass('scorelabel__name--automatic')

        $ect.off 'blur'
        $ect.on 'blur', ()->
          if _inpText isnt _text
            $ect.text(_text)
          if _text is ''
            $ect.addClass('scorelabel__name--automatic')
            $ect.closest('td').find('.scorelabel__edit').trigger('keyup')
          else
            $ect.removeClass('scorelabel__name--automatic')

      offOn 'keyup.namekey', '.scorelabel__edit', (evt)=>
        $ect = $(evt.currentTarget)
        $nameWrap = $ect.closest('.scorelabel').find('.scorelabel__name')
        $nameWrap.attr('data-automatic-name', $modelUtils.sluggify($ect.text(), validXmlTag: true))

      offOn 'input.choicechange', '.scorecell__label', (evt)=>
        $et = $(evt.target)
        get_choice($et.closest('th').data('cid')).set('label', $et.text())

      offOn 'input.optvalchange', '.scorecell__name', (evt)=>
        $et = $(evt.target)
        _text = $et.text()
        if _text is ''
          $et.addClass('scorecell__name--automatic')
        else
          $et.removeClass('scorecell__name--automatic')
        get_choice($et.closest('th').eq(0).data('cid')).set('name', _text)

      offOn 'keyup.optlabelchange', '.scorecell__label', (evt)=>
        $ect = $(evt.currentTarget)
        $nameWrap = $ect.closest('.scorecell__col').find('.scorecell__name')
        $nameWrap.attr('data-automatic-name', $modelUtils.sluggify($ect.text()))

      offOn 'blur.choicechange', '.scorecell__label', (evt)=>
        @render()

      offOn 'click.addchoice', '.scorecell--add', (evt)=>
        @already_rendered = false
        @model._scoreChoices.options.add([label: 'Option'])
        @render(fixScroll: true)

      offOn 'click.addrow', '.scorerow--add', (evt)=>
        @already_rendered = false
        @model._scoreRows.add([label: 'Enter your question'])
        @render(fixScroll: true)

  class RankView extends RankScoreView
    className: "survey__row survey__row--rank"
    _renderRow: (args...)->
      super(args)
      template_args = {}
      template_args.rank_constraint_msg = @model.get('kobo--rank-constraint-message')?.get('value')

      min_rank_levels_count = 2
      if @model._rankRows.length > min_rank_levels_count
        min_rank_levels_count = @model._rankRows.length

      while @model._rankLevels.options.length < min_rank_levels_count
        @model._rankLevels.options.add
          label: "Item to be ranked"
          name: ''

      rank_levels = for model in @model._rankLevels.options.models
        _label = model.get('label')
        _name = model.get('name')
        _automatic = $modelUtils.sluggify(_label)

        label: _label
        name: _name
        automatic: _automatic
        set_automatic: _name is ''
        cid: model.cid
      template_args.rank_levels = rank_levels

      while @model._rankRows.length < 1
        @model._rankRows.add
          label: '1st choice'
          name: ''

      rank_rows = for model in @model._rankRows.models
        _label = model.get('label')
        _name = model.get('name')
        _automatic = $modelUtils.sluggify(_label, validXmlTag: true)

        label: _label
        name: _name
        automatic: _automatic
        set_automatic: _name is ''
        cid: model.cid
      template_args.rank_rows = rank_rows
      extra_score_contents = $viewTemplates.$$render('row.rankView', @, template_args)
      @$('.card--selectquestion__expansion').eq(0).append(extra_score_contents).addClass('js-cancel-select-row')
      @editRanks()
    editRanks: ->
      @$([
          '.rank_items__item__label',
          '.rank_items__level__label',
          '.rank_items__constraint_message',
          '.rank_items__name',
        ].join(',')).attr('contenteditable', 'true')
      $el = @$el
      offOn = (evtName, selector, callback)->
        $el.off(evtName).on(evtName, selector, callback)

      get_item = (evt)=>
        parli = $(evt.target).parents('li').eq(0)
        cid = parli.eq(0).data('cid')
        if parli.hasClass('rank_items__level')
          @model._rankLevels.options.get(cid)
        else
          @model._rankRows.get(cid)

      offOn 'click.deleterankcell', '.js-delete-rankcell', (evt)=>
        if $(evt.target).parents('.rank__rows').length is 0
          collection = @model._rankLevels.options
        else
          collection = @model._rankRows
        item = get_item(evt)
        collection.remove(item)
        @already_rendered = false
        @render(fixScroll: true)

      offOn 'input.ranklabelchange1', '.rank_items__item__label', (evt)->
        $ect = $(evt.currentTarget)
        _text = $ect.text()
        _slugtext = $modelUtils.sluggify(_text, validXmlTag: true)
        $riName = $ect.closest('.rank_items__item').find('.rank_items__name')
        $riName.attr('data-automatic-name', _slugtext)
        get_item(evt).set('label', _text)
      offOn 'input.ranklabelchange2', '.rank_items__level__label', (evt)->
        $ect = $(evt.currentTarget)
        _text = $ect.text()
        _slugtext = $modelUtils.sluggify(_text)
        $riName = $ect.closest('.rank_items__level').find('.rank_items__name')
        $riName.attr('data-automatic-name', _slugtext)
        get_item(evt).set('label', _text)
      offOn 'input.ranklabelchange3', '.rank_items__name', (evt)->
        $ect = $(evt.currentTarget)
        _inptext = $ect.text()
        needs_valid_xml = $ect.parents('.rank_items__item').length > 0
        _text = $modelUtils.sluggify(_inptext, validXmlTag: needs_valid_xml)
        $ect.off 'blur'
        $ect.one 'blur', ->
          if _text is ''
            $ect.addClass('rank_items__name--automatic')
          else
            if _inptext isnt _text
              log 'changin'
              $ect.text(_text)
            $ect.removeClass('rank_items__name--automatic')

        get_item(evt).set('name', _text)

      offOn 'focus', '.rank_items__constraint_message--prelim', (evt)->
        $(evt.target).removeClass('rank_items__constraint_message--prelim').empty()
      offOn 'input.ranklabelchange4', '.rank_items__constraint_message', (evt)=>
        rnkKey = 'kobo--rank-constraint-message'
        @model.get(rnkKey).set('value', evt.target.textContent)
      offOn 'click.addrow', '.rank_items__add', (evt)=>
        if $(evt.target).parents('.rank__rows').length is 0
          # add a level
          @model._rankLevels.options.add({label: 'Item', name: ''})
        else
          chz = "1st 2nd 3rd".split(' ')
          # Please don't go up to 21
          ch = if (@model._rankRows.length + 1 > chz.length) then "#{@model._rankRows.length + 1}th" else chz[@model._rankRows.length]
          @model._rankRows.add({label: "#{ch} choice", name: ''})
        @already_rendered = false
        @render(fixScroll: true)

  RowView: RowView
  ScoreView: ScoreView
  KoboMatrixView: KoboMatrixView
  GroupView: GroupView
  RankView: RankView
