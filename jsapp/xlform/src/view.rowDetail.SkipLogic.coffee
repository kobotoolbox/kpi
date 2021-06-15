_ = require 'underscore'
Backbone = require 'backbone'
$modelRowDetailsSkipLogic = require './model.rowDetails.skipLogic'
$viewWidgets = require './view.widgets'
$skipLogicHelpers = require './mv.skipLogicHelpers'

PLACEHOLDER_VALUE = 'placeholderVal'

module.exports = do ->
  viewRowDetailSkipLogic = {}

  ###----------------------------------------------------------------------------------------------------------###
  #-- View.RowDetail.SkipLogic.CriterionBuilderView.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class viewRowDetailSkipLogic.SkipLogicCriterionBuilderView extends $viewWidgets.Base
    events:
      "click .skiplogic__deletecriterion": "deleteCriterion"
      "click .skiplogic__addcriterion": "addCriterion"
      "change .skiplogic__delimselect": "markChangedDelimSelector"
    render: () ->
      tempId = _.uniqueId("skiplogic_expr")
      @$el.html("""
        <p>
          #{t("This question will only be displayed if the following conditions apply")}
        </p>
        <div class="skiplogic__criterialist"></div>
        <p class="skiplogic__addnew">
          <button class="skiplogic__addcriterion kobo-button kobo-button--green">+ #{t("Add another condition")}</button>
        </p>
        <select class="skiplogic__delimselect">
          <option value="and">#{t("Question should match all of these criteria")}</option>
          <option value="or">#{t("Question should match any of these criteria")}</option>
        </select>
      """)

      delimSelect = @$(".skiplogic__delimselect").val(@criterion_delimiter)
      delimSelect.children('[value=' + @criterion_delimiter + ']').attr('selected', 'selected')

      @

    addCriterion: (evt) =>
      @facade.view_factory.survey.trigger('change')
      @facade.add_empty()

    deleteCriterion: (evt)->
      @facade.view_factory.survey.trigger('change')
      $target = $(evt.target)
      modelId = $target.data("criterionId")
      @facade.remove modelId
      $target.parent().remove()

    markChangedDelimSelector: (evt) ->
      @criterion_delimiter = evt.target.value

  class viewRowDetailSkipLogic.SkipLogicCriterion extends $viewWidgets.Base
    tagName: 'div'
    className: 'skiplogic__criterion'
    render: () ->

      @question_picker_view.render()
      if !@alreadyRendered
        @$el.append $("""<i class="skiplogic__deletecriterion k-icon k-icon-trash" data-criterion-id="#{@model.cid}"></i>""")

      @change_operator @operator_picker_view
      @change_response @response_value_view

      @alreadyRendered = true

      @

    mark_question_specified: (is_specified=false) ->
      @$el.toggleClass("skiplogic__criterion--unspecified-question", not is_specified)

    bind_question_picker: () ->
      questionVal = @$question_picker.val()

      @mark_question_specified(questionVal isnt PLACEHOLDER_VALUE)

      if questionVal isnt PLACEHOLDER_VALUE and questionVal isnt ''
        @question_picker_view.disable_placeholder_option()

      @$question_picker.on('change', (e) =>
        if e.val is PLACEHOLDER_VALUE
          console.error("Changing question to #{PLACEHOLDER_VALUE} should not happen!")

        @model.survey.trigger('change')

        @mark_question_specified(e.val isnt PLACEHOLDER_VALUE)
        @presenter.change_question(e.val)
        return
      )
      return

    bind_operator_picker: () ->
      @$operator_picker.on('change', () =>
        @operator_picker_view.value = @$operator_picker.select2 'val'
        @presenter.change_operator(@operator_picker_view.value)
        @model.survey.trigger('change')
      )

    bind_response_value: () ->
      @response_value_view.bind_event(() =>
        @presenter.change_response(@response_value_view.val())
        @model.survey.trigger('change')
      )

    response_value_handler: () ->
      @presenter.change_response @response_value_view.val()

    change_operator: (@operator_picker_view) ->
      @operator_picker_view.render()

      @$operator_picker = @operator_picker_view.$el

    change_response: (response_value_view) ->
      @response_value_view.detach()
      @response_value_view = response_value_view
      @response_value_view.render()

      @$response_value = @response_value_view.$el

    attach_operator: () ->
      @operator_picker_view.attach_to @$el
      @bind_operator_picker()

    attach_response: () ->
      if @$('.skiplogic__responseval-wrapper').length > 0
        @$('.skiplogic__responseval-wrapper').remove()

      @response_value_view.attach_to(@$el)
      @bind_response_value()

    attach_to: (element) ->
      @question_picker_view.attach_to @$el
      @$question_picker = @question_picker_view.$el
      @bind_question_picker()
      @attach_operator()
      @attach_response()
      super(element)
      return

    constructor: (@question_picker_view, @operator_picker_view, @response_value_view, @presenter) ->
      super()

  ###----------------------------------------------------------------------------------------------------------###
  #-- View.RowDetail.SkipLogic.QuestionPickerView.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class viewRowDetailSkipLogic.QuestionPicker extends $viewWidgets.DropDown
    tagName: 'select'
    className: 'skiplogic__rowselect'

    render: () ->
      super()

      # disable placeholder option onLoad and onChange
      if @$el.val() isnt PLACEHOLDER_VALUE
        @disable_placeholder_option()
      @$el.on('change', @disable_placeholder_option.bind(@))

      return @

    disable_placeholder_option: ->
      $firstChild = @$el.children(':first')
      if $firstChild.val() is PLACEHOLDER_VALUE
        $firstChild.prop('disabled', true)
      return

    attach_to: (target) ->
      target.find('.skiplogic__rowselect').remove()
      super(target)

  ###----------------------------------------------------------------------------------------------------------###
  #-- View.RowDetail.SkipLogic.OperatorPickerView.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class viewRowDetailSkipLogic.OperatorPicker extends $viewWidgets.Base
    tagName: 'div'
    className: 'skiplogic__expressionselect'
    render: () ->
      @

    attach_to: (target) ->
      target.find('.skiplogic__expressionselect').remove()
      super(target)

      @$el.select2({
        minimumResultsForSearch: -1
        data: do () =>
          operators = []
          _.each @operators, (operator) ->
            operators.push id: operator.id, text: operator.label + (if operator.id != 1 then ' (' + operator.symbol[operator.parser_name[0]] + ')' else '')
            operators.push id: '-' + operator.id, text: operator.negated_label + (if operator.id != 1 then ' (' + operator.symbol[operator.parser_name[1]] + ')' else '')

          operators
      })

      # workaround for missing elements when toggling skiplogic back and forth
      target.find('.skiplogic__expressionselect.select2-container').show()

      if @value
        @val @value
      else
        @value = @$el.select2('val')

      @$el.on 'select2-close', () => @_set_style()

    val: (value) ->
      if value?
        @$el.select2 'val', value
        @_set_style()
        @value = value
      else
        return @$el.val()

    _set_style: () -> #violates LSP
      numValue = Number(@$el.val())

      @$el.toggleClass('skiplogic__expressionselect--no-response-value', numValue in [-1, 1])

      absolute_value = Math.abs(numValue)

      if absolute_value is 0
        return

      operator = _.find(@operators, (operator) ->
        return operator.id == absolute_value
      )

      if numValue < 0
        abbreviated_label = operator['abbreviated_negated_label']
      else
        abbreviated_label = operator['abbreviated_label']

      chosen_element = @$el.parents('.skiplogic__criterion').find('.select2-container.skiplogic__expressionselect .select2-chosen')
      chosen_element.text(abbreviated_label)
      return

    constructor: (@operators) ->
      super()

  ###----------------------------------------------------------------------------------------------------------###
  #-- View.RowDetail.SkipLogic.ResponseViews.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class viewRowDetailSkipLogic.SkipLogicEmptyResponse extends $viewWidgets.EmptyView
    className: 'skiplogic__responseval'
    attach_to: (target) ->
      target.find('.skiplogic__responseval').remove()
      super(target)

  class viewRowDetailSkipLogic.SkipLogicTextResponse extends $viewWidgets.TextBox
    attach_to: (target) ->
      target.find('.skiplogic__responseval').remove()
      super(target)
      return

    bind_event: (handler) ->
      @$el.on 'blur', handler

    constructor: (text) ->
      super(text, "skiplogic__responseval", t("response value"))

  class viewRowDetailSkipLogic.SkipLogicValidatingTextResponseView extends viewRowDetailSkipLogic.SkipLogicTextResponse
    render: () ->
      super()
      @setElement('<div class="skiplogic__responseval-wrapper">' + @$el + '<div></div></div>')
      @$error_message = @$('div')
      @model.bind 'validated:invalid', @show_invalid_view
      @model.bind 'validated:valid', @clear_invalid_view
      @$input = @$el.find('input')
      return @

    show_invalid_view: (model, errors) =>
      if @$input.val()
        @$el.addClass('textbox--invalid')
        @$error_message.html(errors.value)
        @$input.focus()
    clear_invalid_view: (model, errors) =>
      @$el.removeClass('textbox--invalid')
      @$error_message.html('')

    bind_event: (handler) ->
      @$input.on 'change', handler

    val: (value) =>
      if value?
        @$input.val(value)
      else
        @$input.val()

  class viewRowDetailSkipLogic.SkipLogicDropDownResponse extends $viewWidgets.DropDown
    tagName: 'select'
    className: 'skiplogic__responseval'

    attach_to: (target) ->
      target.find('.skiplogic__responseval').remove()
      super(target)
      # workaround for missing elements when toggling skiplogic back and forth
      target.find('.skiplogic__responseval.select2-container').show()

    bind_event: (handler) ->
      super 'change', handler

    render: () ->
      super()
      handle_model_cid_change = () =>
        @val(@model.get 'cid')

      @model.off 'change:cid', handle_model_cid_change
      @model.on 'change:cid', handle_model_cid_change

    constructor: (@responses, @model) ->
      super(_.map @responses.models, (response) ->
        text: response.get('label')
        value: response.cid
      )

  ###----------------------------------------------------------------------------------------------------------###
  #-- Factories.RowDetail.SkipLogic.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class viewRowDetailSkipLogic.SkipLogicViewFactory
    constructor: (@survey) ->
    create_question_picker: (target_question) ->
      model = new $viewWidgets.DropDownModel()

      set_options = () =>
        options = _.map(target_question.selectableRows(), (row) ->
          return {
            value: row.cid
            text: row.getValue("label")
          }
        )

        # add placeholder message/option
        options.unshift({
          value: PLACEHOLDER_VALUE
          text: t("Select question from list")
        })

        model.set('options', options)
        return

      set_options()
      @survey.on('sortablestop', set_options)

      return new viewRowDetailSkipLogic.QuestionPicker(model)

    create_operator_picker: (question_type) ->
      operators = if question_type? then _.filter($skipLogicHelpers.operator_types, (op_type) -> op_type.id in question_type.operators) else []
      new viewRowDetailSkipLogic.OperatorPicker operators
    create_response_value_view: (question, question_type, operator_type) ->
      if !question?
        type = 'empty'
      else if operator_type.response_type?
        type = operator_type.response_type
      else
        type = question_type.response_type

      switch type
        when 'empty' then new viewRowDetailSkipLogic.SkipLogicEmptyResponse()
        when 'text' then new viewRowDetailSkipLogic.SkipLogicTextResponse
        when 'dropdown' then new viewRowDetailSkipLogic.SkipLogicDropDownResponse question.getList().options
        when 'integer', 'decimal' then new viewRowDetailSkipLogic.SkipLogicTextResponse
        else null
    create_criterion_view: (question_picker_view, operator_picker_view, response_value_view, presenter) ->
      return new viewRowDetailSkipLogic.SkipLogicCriterion question_picker_view, operator_picker_view, response_value_view, presenter
    create_criterion_builder_view: () ->
      return new viewRowDetailSkipLogic.SkipLogicCriterionBuilderView()
    create_textarea: (text, className) ->
      return new $viewWidgets.TextArea text, className
    create_button: (text, className) ->
      return new $viewWidgets.Button text, className
    create_textbox: (text, className='', placeholder='') ->
      return new $viewWidgets.TextBox text, className, placeholder
    create_label: (text, className) ->
      return new $viewWidgets.Label text, className
    create_empty: () ->
      return new $viewWidgets.EmptyView()


  viewRowDetailSkipLogic
