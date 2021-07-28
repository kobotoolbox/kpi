_ = require 'underscore'
Backbone = require 'backbone'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'
$icons = require './view.icons'
$configs = require './model.configs'

module.exports = do ->
  viewRowSelector = {}

  class viewRowSelector.RowSelector extends $baseView
    events:
      "click .js-close-row-selector": "shrink"

    initialize: (opts)->
      @options = opts
      @ngScope = opts.ngScope
      @reversible = opts.reversible
      @button = @$el.find(".btn").eq(0)
      @line = @$el.find(".line")
      if opts.action is "click-add-row"
        @expand()
      return

    expand: ->
      @$el.parents('.survey-editor__null-top-row--hidden').removeClass('survey-editor__null-top-row--hidden')
      @show_namer()
      $namer_form = @$el.find('.row__questiontypes__form')
      $namer_form.on 'submit', _.bind @show_picker, @
      $namer_form.find('button').on 'click', (evt) ->
        evt.preventDefault()
        $namer_form.submit()
      @$('input').eq(0).focus()
      return

    show_namer: () ->
      $surveyViewEl = @options.surveyView.$el
      $surveyViewEl.find('.line.expanded').removeClass('expanded').empty()
      $surveyViewEl.find('.btn--hidden').removeClass('btn--hidden')

      @button.addClass('btn--hidden')

      @line.addClass "expanded"
      @line.parents(".survey-editor__null-top-row").addClass "expanded"
      @line.css "height", "inherit"
      @line.html $viewTemplates.$$render('xlfRowSelector.namer')
      @scrollFormBuilder('+=50')

      if (@options.surveyView.features.multipleQuestions)
        $(window).on 'keydown.cancel_add_question',  (evt) =>
          # user presses the escape key
          if evt.which == 27
            @shrink()
      else
        $(window).on 'keydown.cancel_add_question',  (evt) =>
          # user presses the escape key
          if evt.which == 27
            evt.preventDefault()
            @$('input').eq(0).focus()

        $('body').on 'mousedown.cancel_add_question', (evt) =>
          if $(evt.target).closest('.line.expanded').length == 0
            evt.preventDefault()
            @$('input').eq(0).focus()
      return

    show_picker: (evt) ->
      evt.preventDefault()
      @question_name = @line.find('input').val()
      @line.empty()
      @line.html $viewTemplates.$$render('xlfRowSelector.line', "")
      @line.find('.row__questiontypes__new-question-name').val(@question_name)
      $menu = @line.find(".row__questiontypes__list")
      for mrow in $icons.grouped()
        menurow = $("<div>", class: "questiontypelist__row").appendTo $menu
        for mitem, i in mrow when mitem
          menurow.append $viewTemplates.$$render('xlfRowSelector.cell', mitem.attributes)

      @scrollFormBuilder('+=220')
      @$('.questiontypelist__item').click _.bind(@onSelectNewQuestionType, @)

      # Keyboard navigation
      toggleKeyboardNavigation = false
      columnIndex = 0
      rowIndex = 0
      currentListRow = $("div.questiontypelist__row")

      $DOWN = 40
      $RIGHT = 39
      $UP = 38
      $LEFT = 37
      $ENTER = 13

      # Always start at top left most item first
      currentListRow.eq(columnIndex).children().eq(0).toggleClass("questiontypelist__item-force-hover")

      $(window).on 'keydown', (evt) =>
        # Toggle previous item off
        currentListRow.eq(columnIndex).children().eq(rowIndex).toggleClass("questiontypelist__item-force-hover")

        # Navigation
        if evt.which == $DOWN
          if rowIndex >= currentListRow.eq(columnIndex).children().length - 1
            rowIndex = 0
          else
            rowIndex++
        if evt.which == $RIGHT
          if columnIndex >= currentListRow.length - 1
            columnIndex = 0
          else
            if currentListRow.eq(columnIndex + 1).children().length < currentListRow.eq(columnIndex).children().length && rowIndex > currentListRow.length
              columnIndex = 0
            else
              columnIndex++
        if evt.which == $UP
          if rowIndex == 0
            rowIndex = currentListRow.eq(columnIndex).children().length - 1
          else
            rowIndex--
        if evt.which == $LEFT
          if columnIndex == 0
            if currentListRow.eq(currentListRow.length - 1).children().length < currentListRow.eq(columnIndex).children().length && rowIndex > currentListRow.length
              columnIndex = currentListRow.length - 2
            else
              columnIndex = currentListRow.length - 1
          else
            if currentListRow.eq(columnIndex - 1).children().length < currentListRow.eq(columnIndex).children().length && rowIndex > currentListRow.eq(columnIndex - 1).length
              columnIndex = currentListRow.length - 1
            else
              columnIndex--

        # Toggle current item on
        currentListRow.eq(columnIndex).children().eq(rowIndex).toggleClass("questiontypelist__item-force-hover")

        # user makes selection by pressing ENTER
        if evt.which == $ENTER
          currentListRow.eq(columnIndex).children().eq(rowIndex).trigger('click')

      return

    shrink: ->
      # click .js-close-row-selector
      $(window).off 'keydown.cancel_add_question'
      $('body').off 'mousedown.cancel_add_question'
      @line.find("div").eq(0).fadeOut 250, =>
        @line.empty()
      @line.parents(".survey-editor__null-top-row").removeClass "expanded"
      if (@line.parents('.survey-editor').find('.survey__row').length)
        @line.parents(".survey-editor__null-top-row").addClass "survey-editor__null-top-row--hidden"
      @line.removeClass "expanded"
      @line.animate height: "0"
      if @reversible
        @button.removeClass('btn--hidden')
      return

    hide: ->
      @button.removeClass('btn--hidden')
      @line.empty().removeClass("expanded").css "height": 0
      @line.parents(".survey-editor__null-top-row")
          .removeClass("expanded")
          .addClass("survey-editor__null-top-row--hidden")
      return

    onSelectNewQuestionType: (evt)->
      @question_name = @line.find('input').val()
      $rowSelect = $('select.skiplogic__rowselect')
      if $rowSelect.data('select2')
        $rowSelect.select2('destroy')
      rowType = $(evt.target).closest('.questiontypelist__item').data("menuItem")

      # if question name not provided by user, use default one for type or general one
      if @question_name
        questionLabelValue = @question_name.replace(/\t/g, ' ')
      else if rowType of $configs.defaultsForType
        questionLabelValue = $configs.defaultsForType[rowType].label.value
      else
        questionLabelValue = $configs.defaultsGeneral.label.value

      rowDetails =
        type: rowType

      if rowType is 'calculate'
        rowDetails.calculation = questionLabelValue
      else
        rowDetails.label = questionLabelValue

      options = {}
      if (rowBefore = @options.spawnedFromView?.model)
        options.after = rowBefore
        survey = rowBefore.getSurvey()
      else
        survey = @options.survey
        options.at = 0

      newRow = survey.addRow(rowDetails, options)
      newRow.linkUp(warnings: [], errors: [])
      @hide()
      return

    ###
    # Scrolls the newly opened element into the screen if it is being opened
    # below the fold. Calling the function doesn't cause the scrolling
    # to happen unless it passes the checks.
    ###
    scrollFormBuilder: (scrollBy)->
      $row = @$el.parents('.survey__row')
      if !$row.length
        return

      $fbC = @$el.parents('.form-builder__contents')

      if $row.height() + $row.position().top + 50 > $fbC.height() + $fbC.prop('scrollTop')
        $fbC.animate scrollTop: scrollBy
      return

  viewRowSelector
