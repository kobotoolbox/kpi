_ = require 'underscore'
Backbone = require 'backbone'
$survey = require './model.survey'
$modelUtils = require './model.utils'
$viewTemplates = require './view.templates'
$surveyDetailView = require './view.surveyDetails'
$viewRowSelector = require './view.rowSelector'
$rowView = require './view.row'
$baseView = require './view.pluggedIn.backboneView'
$viewUtils = require './view.utils'
alertify = require 'alertifyjs'
isAssetLockable = require('js/components/locking/lockingUtils').isAssetLockable
hasAssetRestriction = require('js/components/locking/lockingUtils').hasAssetRestriction
LOCKING_RESTRICTIONS = require('js/components/locking/lockingConstants').LOCKING_RESTRICTIONS
LOCKING_UI_CLASSNAMES = require('js/components/locking/lockingConstants').LOCKING_UI_CLASSNAMES

module.exports = do ->
  surveyApp = {}

  _notifyIfRowsOutOfOrder = do ->
    # a temporary function to notify devs if rows are mysteriously falling out of order
    fn = (surveyApp)->
      if surveyApp.orderfail
        # it's already been reported so no need to report it again
        return
      survey = surveyApp.survey
      elIds = []
      surveyApp.$('.survey__row').each -> elIds.push $(@).data('rowId')

      rIds = []
      gatherId = (r)->
        rIds.push(r.cid)
      survey.forEachRow(gatherId, includeGroups: true)

      _s = (i)-> JSON.stringify(i)
      if _s(rIds) isnt _s(elIds)
        pathname = window.location.pathname
        surveyApp.orderfail = true
        err_message = """
          Row model does not match view: #{_s(rIds)} #{_s(elIds)} #{pathname}
        """.trim()
        console?.error(err_message)
        Raven?.captureException new Error(err_message)

        false
      else
        true
    _.debounce(fn, 2500)


  class SurveyFragmentApp extends $baseView
    className: "formbuilder-wrap container"
    features: {}
    events:
      "click .js-delete-row": "clickRemoveRow"
      "click .js-delete-group": "clickDeleteGroup"
      "click .js-add-to-question-library": "clickAddRowToQuestionLibrary"
      "click .js-clone-question": "clickCloneQuestion"
      "update-sort": "updateSort"
      "click .js-select-row": "selectRow"
      "click .js-select-row--force": "forceSelectRow"
      "click .js-toggle-card-settings": "toggleCardSettings"
      "click .js-toggle-group-expansion": "toggleGroupExpansion"
      "click .js-toggle-row-multioptions": "toggleRowMultioptions"
      "click .js-close-warning": "closeWarningBox"
      "click .js-expand-row-selector": "expandRowSelector"
      "mouseenter .card__buttons__button": "buttonHoverIn"
      "mouseleave .card__buttons__button": "buttonHoverOut"
      "click .card__settings__tabs li": "switchTab"

    @create: (params = {}) ->
      if _.isString params.el
        params.el = $(params.el).get 0
      return new @(params)

    switchTab: (event) ->
      $et = $(event.currentTarget)
      if $et.hasClass("heading")
        event.preventDefault()
        return

      tabId = $et.data('cardSettingsTabId')

      $et.parent('ul').find('.card__settings__tabs__tab--active').removeClass('card__settings__tabs__tab--active')
      $et.addClass('card__settings__tabs__tab--active')

      $et.parents('.card__settings').find(".card__settings__fields--active").removeClass('card__settings__fields--active')
      $et.parents('.card__settings').find(".js-card-settings-#{tabId}").addClass('card__settings__fields--active')

    surveyRowSortableStop: (evt)->
      @survey.trigger('change')

      $et = $(evt.target)
      cid = $et.data('rowId')

      survey_findRowByCid = (cid)=>
        if cid
          @survey.findRowByCid(cid, includeGroups: true)

      row = survey_findRowByCid(cid)
      [_prev, _par] = @_getRelatedElIds($et)
      @survey._insertRowInPlace row,
        previous: survey_findRowByCid _prev
        parent: survey_findRowByCid _par
        event: 'sort'
      return

    _getRelatedElIds: ($el)->
      prev = $el.prev('.survey__row').eq(0).data('rowId')
      parent = $el.parents('.survey__row').eq(0).data('rowId')
      [prev, parent]

    initialize: (options)->
      @reset = (newlyAddedRow = false) =>
        if @_timedReset
          clearTimeout(@_timedReset)
        promise = $.Deferred();
        @_timedReset = setTimeout(
          () =>
            @_reset.call(@, newlyAddedRow)
            promise.resolve()
            return
          , 0
        )

        return promise

      if options.survey and (options.survey instanceof $survey.Survey)
        @survey = options.survey
      else
        @survey = new $survey.Survey(options)

      @warnings = options.warnings || []
      @__rowViews = new Backbone.Model()
      @ngScope = options.ngScope
      @surveyStateStore = options.stateStore || {trigger:$.noop, setState:$.noop}

      $(document).on 'click', @deselect_rows

      @survey.settings.on 'change:form_id', (model, value) =>
        $('.form-id').text(value)
      @survey.on('rows-add', @reset, @)
      @survey.on('rows-remove', @reset, @)
      @survey.on "row-detail-change", (row, key, val, ctxt)=>
        if key.match(/^\$/)
          return
        evtCode = $viewUtils.normalizeEventName("row-detail-change-#{key}")
        @$(".on-#{evtCode}").trigger(evtCode, row, key, val, ctxt)
      @$el.on "choice-list-update", (evt, clId) =>
        $(".on-choice-list-update[data-choice-list-cid='#{clId}']").trigger("rebuild-choice-list")
        @survey.trigger 'choice-list-update', clId

      @$el.on "survey__row-sortablestop", _.bind @surveyRowSortableStop, @

      @onPublish = options.publish || $.noop
      @onSave = options.save || $.noop
      @onPreview = options.preview || $.noop

      @expand_all_multioptions = () -> @$('.survey__row:not(.survey__row--deleted) .card--expandedchoices:visible').length > 0

      # Keyboard Navigation
      currentLabelIndex = 0
      hoverOver = false
      $(window).on "keydown", (evt)=>
        focusedElement = $(':focus')
        if evt.keyCode == 13
          evt.preventDefault()
          # preventDefault stops ENTER from pressing twice, need to trigger click when adding question label
          $('div.row__questiontypes').find('button').eq(1).trigger('click')
          focusedElement = $(':focus')
          # ENTER should highlight add choice button first
          if focusedElement.hasClass('editable-wrapper')
            if hoverOver
              focusedElement.trigger('click')
              hoverOver = false
            else
              hoverOver = true
          else if focusedElement.css('display') == 'none'
            focusedElement.css('display', 'block')
          else
            focusedElement.trigger('click')

        @onEscapeKeydown(evt)  if evt.keyCode is 27

    getView: (cid)->
      @__rowViews.get(cid)

    updateSort: (evt, model, position)->
      # inspired by this:
      # http://stackoverflow.com/questions/10147969/saving-jquery-ui-sortables-order-to-backbone-js-collection
      @survey.rows.remove(model)
      @survey.rows.each (m, index)->
        m.ordinal = if index >= position then (index + 1) else index
      model.ordinal = position
      @survey.rows.add(model, at: position)
      return

    forceSelectRow: (evt)->
      # forceSelectRow is used to mock the multiple-select key
      @selectRow($.extend({}, evt))

    deselect_all_rows: () ->
      @$('.survey__row').removeClass('survey__row--selected')
      @activateGroupButton(false)
      return

    deselect_rows: (evt) =>
      # clicking on survey__row is aleady handled, so we ignore it - we only want
      # to deselet rows when clicking elsewhere
      $etp = $(evt.target).parents('.survey__row')
      if !!$etp.length
        return
      else
        @deselect_all_rows()
      return

    selectRow: (evt)->
      $et = $(evt.target)
      if $et.hasClass('js-blur-on-select-row') || $et.hasClass('editable-wrapper')
        return
      $ect = $(evt.currentTarget)
      if $et.closest('.card__settings, .card__buttons, .group__header__buttons, .js-cancel-select-row').length > 0
        return
      # a way to ensure the event is not run twice when in nested .js-select-row elements
      _isIntendedTarget = $ect.closest('.survey__row').get(0) is $et.closest('.survey__row').get(0)
      if _isIntendedTarget
        $target = $et.closest('.survey__row')
        if !(evt.ctrlKey || evt.metaKey)
          selected_rows = $target.siblings('.survey__row--selected')
          if !$target.hasClass('survey__row--selected') || selected_rows.length > 1
            @deselect_all_rows()

        $target.toggleClass("survey__row--selected")
        if $target.hasClass('survey__row--group')
          $target.find('li.survey__row, li.survey__row--group').toggleClass("survey__row--selected", $target.hasClass("survey__row--selected"))

        $group = $target.parent().closest('.survey__row')
        if $group.length > 0
          @select_group_if_all_items_selected($group)

        @questionSelect()
        @$('.js-blur-on-select-row').blur()
      return

    select_group_if_all_items_selected: ($group) ->
      $rows = $group.find('.survey__row')
      $group.toggleClass('survey__row--selected', $rows.length == $rows.filter('.survey__row--selected').length)
      $group = $group.parent().closest('.survey__row')
      if $group.length > 0
        @select_group_if_all_items_selected($group)

    questionSelect: () ->
      @activateGroupButton(@$el.find('.survey__row--selected').length > 0)
      return

    activateGroupButton: (active) ->
      @surveyStateStore.setState({groupButtonIsActive: active})
      $('.form-builder-header__button--group').attr('disabled', !active)
      return

    getApp: -> @

    _getViewForTarget: (evt)->
      $et = $(evt.currentTarget)
      modelId = $et.closest('.survey__row').data('row-id')
      view = @__rowViews.get(modelId)
      throw new Error("view is not found for target element")  unless view
      view

    toggleCardSettings: (evt)->
      @_getViewForTarget(evt).toggleSettings()

    toggleGroupExpansion: (evt)->
      view = @_getViewForTarget(evt)
      groupsAreShrunk = view.$el.hasClass('group--shrunk')
      @surveyStateStore.setState({
          groupShrunk: groupsAreShrunk
        })
      $et = $(evt.currentTarget)
      $et.toggleClass('k-icon-caret-down')
      $et.toggleClass('k-icon-caret-right')

      view.$el.toggleClass('group--shrunk', !groupsAreShrunk)


    toggleRowMultioptions: (evt)->
      $et = $(evt.currentTarget)
      $et.find('.k-icon').toggleClass('k-icon-caret-right')
      $et.find('.k-icon').toggleClass('k-icon-caret-down')

      view = @_getViewForTarget(evt)
      view.toggleMultioptions()
      return

    expandRowSelector: (evt)->
      $ect = $(evt.currentTarget)
      if $ect.parents('.survey-editor__null-top-row').length > 0
        # This is the initial row in the survey
        @null_top_row_view_selector.expand()
      else
        $row = $ect.parents('.survey__row').eq(0)
        $spacer = $ect.parents('.survey__row__spacer')
        rowId = $row.data('rowId')
        view = @getViewForRow(cid: rowId)
        if !view
          # hopefully, this error is never triggered
          throw new Error('View for row was not found: ' + rowId)

        new $viewRowSelector.RowSelector(el: $spacer.get(0), ngScope: @ngScope, spawnedFromView: view, surveyView: @, reversible:true, survey: @survey).expand()

    _render_html: ->
      @$el.html $viewTemplates.$$render('surveyApp', @)
      @formEditorEl = @$(".-form-editor")
      @settingsBox = @$(".form__settings-meta__questions")
      return

    _render_attachEvents: ->
      @survey.settings.on 'validated:invalid', (model, validations) ->
        for key, value of validations
            break

      $inps = {}
      _settings = @survey.settings
      return

    hasRestriction: (restrictionName) ->
      return hasAssetRestriction(@ngScope.rawSurvey, restrictionName)

    isLockable: ->
      return isAssetLockable(@ngScope.assetType?.id)

    applyLocking: ->
      # hide all ways of adding new questions
      if (
        @isLockable() and
        @hasRestriction(LOCKING_RESTRICTIONS.question_add.name)
      )
        # "+" buttons
        @$('.js-add-row-button').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)
        # clone buttons
        @$('.js-clone-question').addClass(LOCKING_UI_CLASSNAMES.HIDDEN)

      return

    _render_addSubViews: ->
      meta_view = new $viewUtils.ViewComposer()

      for detail in @survey.surveyDetails.models
        if detail.get('name') in ["start", "end", "today", "deviceid"]
          meta_view.add new $surveyDetailView.SurveyDetailView(model: detail, selector: '.settings__first-meta')
        else
          meta_view.add new $surveyDetailView.SurveyDetailView(model: detail, selector: '.settings__second-meta')

      meta_view.render()
      meta_view.attach_to @settingsBox

      # in which cases is the null_top_row_view_selector viewed
      @null_top_row_view_selector = new $viewRowSelector.RowSelector(el: @$el.find(".survey__row__spacer").get(0), survey: @survey, ngScope: @ngScope, surveyView: @, reversible:true)

    _render_hideConditionallyDisplayedContent: ->
      if !@features.multipleQuestions
        @$el.addClass('survey-editor--singlequestion')
        @$el.find(".survey-editor__null-top-row").addClass("survey-editor__null-top-row--hidden")
        @$el.find(".js-expand-row-selector").addClass("btn--hidden")
        if @survey.rows.length is 0
          @null_top_row_view_selector.expand()

      if !@features.copyToLibrary
        @$el.find('.js-add-to-question-library').hide()

    render: ()->
      @$el.addClass("survey-editor--loading")
      @$el.removeClass("content--centered").removeClass("content")

      try
        @_render_html()
        @_render_attachEvents()
        @_render_addSubViews()
        @_reset()

        @_render_hideConditionallyDisplayedContent()

        @applyLocking()

      catch error
        @$el.addClass("survey-editor--error")
        throw error

      @$el.removeClass("survey-editor--loading")
      @

    shrinkAllGroups: ->
      @$('.survey__row--group:not(.group--shrunk)').each (i, el) ->
        if !$(el).hasClass('group--shrunk')
          $(el).find('.group__caret').click()

    expandAllGroups: ->
      depth = 0
      while @$('.survey__row--group.group--shrunk').length > 0
        @$('.survey__row--group.group--shrunk').each (i, el) ->
          $(el).find('.group__caret').click()
        if depth++ > 10
          break

    expandMultioptions: ->
      if @expand_all_multioptions()
        @shrinkAllGroups()
        @$(".card--expandedchoices").each (i, el)=>
          @_getViewForTarget(currentTarget: el).hideMultioptions()
          ``
        _expanded = false
      else
        @expandAllGroups()
        @$(".card--selectquestion").each (i, el)=>
          @_getViewForTarget(currentTarget: el).showMultioptions()
          ``
        _expanded = true

      @surveyStateStore.trigger({
          multioptionsExpanded: _expanded
        })
      return

    closeWarningBox: (evt)->
      @$('.survey-warnings').hide()

    getItemPosition: (item) ->
      i = 0
      while item.length > 0
        item = item.prev()
        i++

      return i

    # responsible for groups and questions sortable
    activateSortable: ->
      $el = @formEditorEl
      survey = @survey

      sortable_activate_deactivate = (evt, ui)=>
        isActivateEvt = evt.type is 'sortactivate'
        ui.item.toggleClass 'sortable-active', isActivateEvt
        $el.toggleClass 'insort', isActivateEvt

        @survey.trigger evt.type

      sortable_stop = (evt, ui)=>
        $(ui.item).trigger('survey__row-sortablestop')
        @survey.trigger 'sortablestop'

      @formEditorEl.sortable({
          # PM: commented out axis, because it's better if cards move horizontally and vertically
          # axis: "y"
          cancel: "button, .btn--addrow, .well, ul.list-view, li.editor-message, .editableform, .row-extras, .js-cancel-sort"
          cursor: "move"
          distance: 5
          items: "> li"
          placeholder: "placeholder"
          connectWith: ".group__rows"
          opacity: 0.9
          scroll: true
          stop: sortable_stop
          activate: sortable_activate_deactivate
          deactivate: sortable_activate_deactivate
          create: =>
            @formEditorEl.addClass('js-sortable-enabled')
            return
          receive: (evt, ui) =>
            itemUid = ui.item.data().uid
            if @ngScope.handleItem and itemUid
              prevItemPosition = @getItemPosition(ui.item.prev())
              @ngScope.handleItem({
                position: prevItemPosition - 1
                itemUid: itemUid
              })
              # element has a custom handler, so we need to stop sortable
              # instance from its default reaction
              ui.sender.sortable('cancel')

            # default action is handled by surveyRowSortableStop
            return
        })

      # apply sortable to all groups
      group_rows = @formEditorEl.find('.group__rows')
      group_rows.each (index) =>
        $(group_rows[index]).sortable({
          cancel: 'button, .btn--addrow, .well, ul.list-view, li.editor-message, .editableform, .row-extras, .js-cancel-sort, .js-cancel-group-sort' + index
          cursor: "move"
          distance: 5
          items: "> li"
          placeholder: "placeholder"
          connectWith: ".group__rows, .survey-editor__list"
          opacity: 0.9
          scroll: true
          stop: sortable_stop
          activate: sortable_activate_deactivate
          deactivate: sortable_activate_deactivate
          create: =>
            # HACK: We dispatch this event to make all instances know that
            # sortable is created (so in fact rendered). This allows for the
            # groups to check themselves if they should disable it due to
            # locking restrictions.
            @survey.trigger('group-sortable-created', group_rows[index])
            $(group_rows[index]).addClass('js-sortable-enabled')
            return
          receive: (evt, ui) =>
            itemUid = ui.item.data().uid
            if @ngScope.handleItem and itemUid
              uiItemParentWithId = $(ui.item).parents('[data-row-id]')[0]
              if uiItemParentWithId
                groupId = uiItemParentWithId.dataset.rowId
              @ngScope.handleItem({
                position: @getItemPosition(ui.item.prev()),
                itemUid: itemUid,
                groupId: groupId
              })
              # element has a custom handler, so we need to stop sortable
              # instance from its default reaction
              ui.sender.sortable('cancel')

            # default action is handled by surveyRowSortableStop
            return
        })
        $(@).attr('data-sortable-index', index)

      group_rows.find('.survey__row').each @_preventSortableIfGroupTooSmall

      return
    _preventSortableIfGroupTooSmall: (index, element)->
      $element = $(element)
      class_name_matches = element.className.match(/js-cancel-group-sort\d+/g)
      if class_name_matches?
        $element.removeClass class_name_matches.join(' ')
      if $element.siblings('.survey__row').length is 0
        $element.addClass('js-cancel-group-sort' + ($element.closest('.group__rows').attr('data-sortable-index')))

    validateSurvey: ()->
      if !@features.multipleQuestions
        return @survey.rows.length == 1

      return @survey._validate()

    ensureElInView: (row, parentView, $parentEl)->
      view = @getViewForRow(row)
      $el = view.$el
      index = row._parent.indexOf(row)

      if index > 0
        prevRow = row._parent.at(index - 1)
      if prevRow
        prevRowEl = $parentEl.find(".survey__row[data-row-id=#{prevRow.cid}]")

      requiresInsertion = false
      detachRowEl = (detach)->
        $el.detach()
        requiresInsertion = true

      # trying to avoid unnecessary reordering of DOM (very slow)
      if $el.parents($parentEl).length is 0
        detachRowEl()
      else if $el.parent().get(0) isnt $parentEl.get(0)
        # element does not have the correct parent
        detachRowEl()
      else if !prevRow
        if $el.prev('.survey__row').not('.survey__row--deleted').data('rowId')
          detachRowEl()
      else if $el.prev('.survey__row').not('.survey__row--deleted').data('rowId') isnt prevRow.cid
        # element is in the wrong location
        detachRowEl()

      if requiresInsertion
        if prevRow
          $el.insertAfter(prevRowEl)
        else
          $el.appendTo($parentEl)
      view

    getViewForRow: (row)->
      unless (xlfrv = @__rowViews.get(row.cid))
        if row.getValue('type') is 'kobomatrix'
          rv = new $rowView.KoboMatrixView(model: row, ngScope: @ngScope, surveyView: @)
        else if row.constructor.kls is 'Group'
          rv = new $rowView.GroupView(model: row, ngScope: @ngScope, surveyView: @)
        else if row.get('type').getValue() is 'score'
          rv = new $rowView.ScoreView(model: row, ngScope: @ngScope, surveyView: @)
        else if row.get('type').getValue() is 'rank'
          rv = new $rowView.RankView(model: row, ngScope: @ngScope, surveyView: @)
        else
          rv = new $rowView.RowView(model: row, ngScope: @ngScope, surveyView: @)
        @__rowViews.set(row.cid, rv)
        xlfrv = @__rowViews.get(row.cid)
      xlfrv

    _reset: (newlyAddedRow = false) ->
      _notifyIfRowsOutOfOrder(@)

      isEmpty = true

      @survey.forEachRow((
        (row) =>
          if !@features.skipLogic
            row.unset 'relevant'
          isEmpty = false
          @ensureElInView(row, @, @formEditorEl).render()
        ), {
          includeErrors: true,
          includeGroups: true,
          flat: true
        })

      newlyAddedEl = null
      newlyAddedType = null
      if newlyAddedRow
        newlyAddedEl = $("*[data-row-id=\"#{newlyAddedRow.cid}\"]")
        newlyAddedType = newlyAddedRow.getValue('type')

      if (
        newlyAddedEl and
        newlyAddedType and
        (
          newlyAddedType.includes('select_one') or
          newlyAddedType.includes('select_multiple')
        )
      )
        # If newest question has choices then hightlight the first choice
        newlyAddedEl.find('input.option-view-input').eq(0).select()
      else if newlyAddedEl
        # focus on the next add row button
        closestAddrow = newlyAddedEl.find('.btn--addrow').eq(0)
        closestAddrow.addClass('btn--addrow-force-show')
        closestAddrow.focus()
        $(document).one('keydown click', (evt) =>
          closestAddrow.removeClass('btn--addrow-force-show')
          closestAddrow.blur()
        )

      null_top_row = @formEditorEl.find(".survey-editor__null-top-row").removeClass("expanded")
      null_top_row.toggleClass("survey-editor__null-top-row--hidden", !isEmpty)

      if (
        @features.multipleQuestions and
        not (
          @isLockable() and
          @hasRestriction(LOCKING_RESTRICTIONS.question_order_edit.name)
        )
      )
        @activateSortable()

      return

    clickDeleteGroup: (evt)->
      @_getViewForTarget(evt).deleteGroup(evt)

    clickAddRowToQuestionLibrary: (evt)->
      @_getViewForTarget(evt).add_row_to_question_library(evt)

    clickCloneQuestion: (evt)->
      @_getViewForTarget(evt).clone()

    clickRemoveRow: (evt)->
      evt.preventDefault()
      if confirm(t("Are you sure you want to delete this question?") + " " +
          t("This action cannot be undone."))
        @survey.trigger('change')

        $et = $(evt.target)
        rowEl = $et.parents(".survey__row").eq(0)
        rowId = rowEl.data("rowId")

        matchingRow = false
        findMatch = (r)->
          if r.cid is rowId
            matchingRow = r
          return

        @survey.forEachRow findMatch, {
          includeGroups: false
        }

        if !matchingRow
          throw new Error("Matching row was not found.")

        parent = matchingRow._parent._parent
        matchingRow.detach()
        # this slideUp is for add/remove row animation
        rowEl.addClass('survey__row--deleted')
        rowEl.slideUp 175, "swing", ()=>
          rowEl.remove()
          @survey.rows.remove matchingRow
          # remove group if after deleting row the group is empty
          if parent.constructor.kls == "Group" && parent.rows.length == 0
            parent_view = @__rowViews.get(parent.cid)
            if !parent_view
              Raven?.captureException("parent view is not defined", matchingRow.get('name').get('value'))
            parent_view._deleteGroup()
      return

    groupSelectedRows: ->
      rows = @selectedRows()
      $q = @$('.survey__row--selected')
      $q.detach()
      $q.removeClass('survey__row--selected')
      @activateGroupButton(false)
      if rows.length > 0
        @survey._addGroup(__rows: rows)
        @reset()
        return true
      else
        return false

    selectedRows: ()->
      rows = []
      @$el.find('.survey__row--selected').each (i, el)=>
        $el = $(el)
        if $el.parents('li.survey__row--group.survey__row--selected').length > 0
          return
        rowId = $el.data("rowId")
        matchingRow = false
        findMatch = (row)->
          if row.cid is rowId
            matchingRow = row
        @survey.forEachRow findMatch, includeGroups: true
        # matchingRow = @survey.rows.find (row)-> row.cid is rowId
        rows.push matchingRow
      return rows

    onEscapeKeydown: -> #noop. to be overridden

    buttonHoverIn: (evt)->
      evt.stopPropagation()
      $et = $(evt.currentTarget)
      buttonName = $et.data('buttonName')
      $et.closest('.card').addClass('card--shaded')
      $header = $et.closest('.card__header')
      card_hover_text = do ->
        if buttonName is 'settings'
          t("[button triggers] Settings")
        else if buttonName is 'delete'
          t("[button triggers] Delete Question")
        else if buttonName is 'duplicate'
          t("[button triggers] Duplicate Question")
        else if buttonName is 'add-to-library'
          t("[button triggers] Add Question to Library")

      $header.find('.card__header--shade').eq(0).children('span').eq(0)
        .attr('data-card-hover-text', card_hover_text)
      $header.addClass(buttonName)
      return
    buttonHoverOut: (evt)->
      evt.stopPropagation()
      $et = $(evt.currentTarget)
      buttonName = $et.data('buttonName')
      $et.closest('.card__header').removeClass(buttonName)
      $et.closest('.card').removeClass('card--shaded')
      return

  class surveyApp.SurveyApp extends SurveyFragmentApp
    features:
      multipleQuestions: true
      skipLogic: true
      copyToLibrary: true

  surveyApp
