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

    expand: ->
      @$el.parents('.survey-editor__null-top-row--hidden').removeClass('survey-editor__null-top-row--hidden')
      @show_namer()
      $namer_form = @$el.find('.row__questiontypes__form')
      $namer_form.on 'submit', _.bind @show_picker, @
      $namer_form.find('button').on 'click', (evt) ->
        evt.preventDefault()
        $namer_form.submit()
      @$('input').eq(0).focus()

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
    hide: ->
      @button.removeClass('btn--hidden')
      @line.empty().removeClass("expanded").css "height": 0
      @line.parents(".survey-editor__null-top-row")
          .removeClass("expanded")
          .addClass("survey-editor__null-top-row--hidden")

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

    scrollFormBuilder: (scrollBy)->
      $row = @$el.parents('.survey__row')
      if !$row.length
        return

      $fbC = @$el.parents('.formBuilder__contents')

      if $row.height() + $row.position().top + 50 > $fbC.height() + $fbC.prop('scrollTop')
        $fbC.animate scrollTop: scrollBy

  viewRowSelector
