_ = require 'underscore'
Backbone = require 'backbone'
$skipLogicParser = require './model.skipLogicParser'

module.exports = do ->
  skipLogicHelpers = {}

  ###----------------------------------------------------------------------------------------------------------###
  #-- Factories.RowDetail.SkipLogic.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class skipLogicHelpers.SkipLogicHelperFactory
    constructor: (@model_factory, @view_factory, @survey, @current_question, @serialized_criteria) ->
    create_presenter: (criterion_model, criterion_view) ->
      return new skipLogicHelpers.SkipLogicPresenter criterion_model, criterion_view, @current_question, @survey, @view_factory
    create_builder: () ->
      return new skipLogicHelpers.SkipLogicBuilder @model_factory, @view_factory, @survey, @current_question, @
    create_context: () ->
      return new skipLogicHelpers.SkipLogicHelperContext @model_factory, @view_factory, @, @serialized_criteria

  ###----------------------------------------------------------------------------------------------------------###
  #-- Facades.RowDetail.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class skipLogicHelpers.SkipLogicPresentationFacade
    constructor: (@model_factory, @helper_factory, @view_factory) ->
    initialize: () ->
      @context ?= @helper_factory.create_context()
    serialize: () ->
      @context ?= @helper_factory.create_context()
      return @context.serialize()
    render: (target) ->
      @context ?= @helper_factory.create_context()
      @context.render target

  ###----------------------------------------------------------------------------------------------------------###
  #-- Presentation.RowDetail.SkipLogic.Presenter.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class skipLogicHelpers.SkipLogicPresenter
    constructor: (@model, @view, @current_question, @survey, @view_factory) ->
      @view.presenter = @
      if @survey
        update_choice_list = (choicelist_cid) =>
          question = @model._get_question()

          if question && question._isSelectQuestion() && question.getList().cid == choicelist_cid

            current_response_value = @model.get('response_value').get('cid')

            if !question.getList().options.get current_response_value
              @dispatcher.trigger 'remove:presenter', @model.cid
            else
              options = _.map question.getList().options.models, (response) ->
                text: response.get('label')
                value: response.cid

              response_picker_model = @view.response_value_view.options

              response_picker_model.set 'options', options
              @view.response_value_view.val(current_response_value)
              @view.response_value_view.$el.trigger('change')
              @model.change_response current_response_value

        @survey.on 'choice-list-update', update_choice_list, @

        @survey.on 'remove-option', update_choice_list, @

        @survey.on 'row-detail-change', (row, key) =>
          if @destination
            if key == 'label'
              @render(@destination)
        , @
      else
        console.error "this.survey is not yet available"

    change_question: (question_name) ->
      @model.change_question question_name

      @question = @model._get_question()
      question_type = @question.get_type()
      @question.on 'remove', () =>
        @dispatcher.trigger 'remove:presenter', @model.cid

      @view.change_operator @view_factory.create_operator_picker question_type
      @view.operator_picker_view.val @model.get('operator').get_value()
      @view.attach_operator()

      @change_response_view question_type, @model.get('operator').get_type()

      @finish_changing()

    change_operator: (operator_id) ->
      @model.change_operator operator_id

      @change_response_view @model._get_question().get_type(), @model.get('operator').get_type()

      @finish_changing()

    change_response: (response_text) ->
      @model.change_response response_text
      @finish_changing()

    change_response_view: (question_type, operator_type) ->
      response_view = @view_factory.create_response_value_view @model._get_question(), question_type, operator_type
      response_view.model = @model.get 'response_value'

      @view.change_response response_view
      @view.attach_response()

      response_value = response_view.model.get('value')

      question = @model._get_question()
      if (question._isSelectQuestion())
        rV = _.find(question.getList().options.models, (option) ->
          option.get('name') == response_value)
        if (rV && rV.cid)
          response_value = rV.cid

      @view.response_value_view.val response_value
      response_view.$el.trigger('change')


    finish_changing: () ->
      @dispatcher.trigger 'changed:model', @

    is_valid: () ->
      if !@model._get_question()
        return false
      else if @model.get('operator').get_type().id == 1
        return true
      else if @model.get('response_value').get('value')  in ['', undefined] || @model.get('response_value').isValid() == false
        return false
      else
        return true

    render: (@destination) ->
      @view.question_picker_view.detach()
      @view.question_picker_view = @view_factory.create_question_picker @current_question
      @view.render()
      @view.question_picker_view.val @model.get('question_cid')
      @view.operator_picker_view.val @model.get('operator').get_value()
      response_value = @model.get('response_value')?.get('value')

      question = @model._get_question()
      if (question && question._isSelectQuestion())
        response_value = _.find(question.getList().options.models, (option) ->
          option.get('name') == response_value)?.cid
      @view.response_value_view.val response_value
      @view.attach_to @destination
      @dispatcher.trigger 'rendered', @

    serialize: () ->
      @model.serialize()

  class skipLogicHelpers.SkipLogicBuilder
    constructor: (@model_factory, @view_factory, @survey, @current_question, @helper_factory) -> return
    build_criterion_builder: (serialized_criteria) ->
      if serialized_criteria == ''
        return [[@build_empty_criterion()], 'and']

      try
        parsed = @_parse_skip_logic_criteria serialized_criteria

        criteria = _.filter(_.map(parsed.criteria, (criterion) =>
            @criterion = criterion
            @build_criterion()
          )
        , (item) -> !!item)
        if criteria.length == 0
          criteria.push @build_empty_criterion()

      catch e
        Raven?.captureException new Error('could not parse skip logic. falling back to hand-coded'), extra:
          criteria: serialized_criteria
        return false
      return [criteria, parsed.operator]

    _parse_skip_logic_criteria: (criteria) ->
      return $skipLogicParser criteria

    build_operator_logic: (question_type) =>
      return [
        @build_operator_model(question_type, @_operator_type().symbol[@criterion.operator]),
        @view_factory.create_operator_picker question_type
      ]

    build_operator_model: (question_type, symbol) ->
      operator_type = @_operator_type()
      return @model_factory.create_operator(
        (if operator_type.type == 'existence' then 'existence' else question_type.equality_operator_type),
        symbol,
        operator_type.id)

    _operator_type: () ->
      return _.find skipLogicHelpers.operator_types, (op_type) =>
          @criterion?.operator in op_type.parser_name

    build_criterion_logic: (operator_model, operator_picker_view, response_value_view) ->
      criterion_model = @model_factory.create_criterion_model()
      criterion_model.set('operator', operator_model)

      criterion_view = @view_factory.create_criterion_view(
        @view_factory.create_question_picker(@current_question),
        operator_picker_view,
        response_value_view
      )
      criterion_view.model = criterion_model
      return @helper_factory.create_presenter criterion_model, criterion_view

    build_criterion: () =>
      question = @_get_question()
      if !question
        return false

      if !(question in @questions())
        throw 'question is not selectable'

      question_type = question.get_type()

      [operator_model, operator_picker_view] = @build_operator_logic question_type

      response_value_view = @view_factory.create_response_value_view question, question_type, @_operator_type()

      presenter = @build_criterion_logic operator_model, operator_picker_view, response_value_view
      presenter.model.change_question question.cid

      response_value = if question._isSelectQuestion() then _.find(question.getList().options.models, (option) => return option.get('name') == @criterion.response_value)?.cid else @criterion.response_value
      presenter.model.change_response response_value || ''
      response_value_view.model = presenter.model.get 'response_value'
      response_value_view.val(response_value)

      return presenter
    _get_question: () ->
      @survey.findRowByName @criterion.name

    build_empty_criterion: () =>
      operator_picker_view = @view_factory.create_operator_picker null
      response_value_view = @view_factory.create_response_value_view null

      return @build_criterion_logic @model_factory.create_operator('empty'), operator_picker_view, response_value_view

    questions: () ->
      @selectable = @current_question.selectableRows() || @selectable
      return @selectable


  ###----------------------------------------------------------------------------------------------------------###
  #-- Presentation.RowDetail.SkipLogic.State.coffee
  ###----------------------------------------------------------------------------------------------------------###

  class skipLogicHelpers.SkipLogicHelperContext
    render: (@destination) ->
      if @destination?
        @destination.empty()
        @state.render @destination
      return
    serialize: () ->
      return @state.serialize()
    use_criterion_builder_helper: () ->
      @builder ?= @helper_factory.create_builder()
      presenters = @builder.build_criterion_builder(@state.serialize())

      if presenters == false
        @state = null
      else
        @state = new skipLogicHelpers.SkipLogicCriterionBuilderHelper(presenters[0], presenters[1], @builder, @view_factory, @)
        @render @destination
      return
    use_hand_code_helper: () ->
      @state = new skipLogicHelpers.SkipLogicHandCodeHelper(@state.serialize(), @builder, @view_factory, @)
      @render @destination
      return
    use_mode_selector_helper : () ->
      @helper_factory.survey.off null, null, @state
      @state = new skipLogicHelpers.SkipLogicModeSelectorHelper(@view_factory, @)
      @render @destination
      return
    constructor: (@model_factory, @view_factory, @helper_factory, serialized_criteria) ->
      @state = serialize: () -> return serialized_criteria
      if !serialized_criteria? || serialized_criteria == ''
        serialized_criteria = ''
        @use_mode_selector_helper()
      else
        @use_criterion_builder_helper()

      if !@state?
        @state = serialize: () -> return serialized_criteria
        @use_hand_code_helper()

  class skipLogicHelpers.SkipLogicCriterionBuilderHelper
    determine_criterion_delimiter_visibility: () ->
      if @presenters.length < 2
        @$criterion_delimiter.hide()
      else
        @$criterion_delimiter.show()
    render: (destination) ->
      @view.render().attach_to destination
      @$criterion_delimiter = @view.$(".skiplogic__delimselect")
      @$add_new_criterion_button = @view.$('.skiplogic__addcriterion')

      @determine_criterion_delimiter_visibility()

      @destination = @view.$('.skiplogic__criterialist')

      _.each @presenters, (presenter) =>
        presenter.render @destination

    serialize: () ->
      serialized = _.map @presenters, (presenter) ->
        presenter.serialize()
      _.filter(serialized, (crit) -> crit).join(' ' + @view.criterion_delimiter + ' ')
    add_empty: () ->
      presenter = @builder.build_empty_criterion()
      presenter.dispatcher = @dispatcher
      presenter.serialize_all = _.bind @serialize, @
      @presenters.push presenter
      presenter.render @destination
      @determine_criterion_delimiter_visibility()
    remove: (id) ->
      _.each @presenters, (presenter, index) =>
        if presenter? && presenter.model.cid == id
          presenter = @presenters.splice(index, 1)[0]
          presenter.view.$el.remove()
          @builder.survey.off null, null, presenter
          @determine_add_new_criterion_visibility()

      if @presenters.length == 0
        @context.use_mode_selector_helper()

    determine_add_new_criterion_visibility: () ->
      if @all_presenters_are_valid()
        action = 'show()'
        @$add_new_criterion_button?.show()
      else
        action = 'hide()'
        @$add_new_criterion_button?.hide()

      if !@$add_new_criterion_button
        Raven?.captureException("@$add_new_criterion_button is not defined. cannot call #{action} [inside of determine_add_new_criterion_visibility]")

    constructor: (@presenters, separator, @builder, @view_factory, @context) ->
      @view = @view_factory.create_criterion_builder_view()
      @view.criterion_delimiter = (separator || 'and').toLowerCase()
      @view.facade = @
      @dispatcher = _.clone Backbone.Events
      @dispatcher.on 'remove:presenter', (cid) =>
        @remove cid


      @dispatcher.on 'changed:model', (presenter) =>
        @determine_add_new_criterion_visibility()

      @dispatcher.on 'rendered', (presenter) =>
        @determine_add_new_criterion_visibility()

      removeInvalidPresenters = () =>
        questions = @builder.questions()
        presenters_to_be_removed = []
        _.each @presenters, (presenter) ->
          if presenter.model._get_question() && !(presenter.model._get_question() in questions)
            presenters_to_be_removed.push presenter.model.cid

        for presenter in presenters_to_be_removed
          @remove presenter

        if @presenters.length == 0
          @context.use_mode_selector_helper()

      @builder.survey.on 'sortablestop', removeInvalidPresenters, @

      removeInvalidPresenters()

      _.each @presenters, (presenter) =>
        presenter.dispatcher = @dispatcher
        presenter.serialize_all = _.bind @serialize, @

    all_presenters_are_valid: () ->
        return !_.find @presenters, (presenter) -> !presenter.is_valid()

    switch_editing_mode: () ->
      @builder.build_hand_code_criteria @serialize()

  class skipLogicHelpers.SkipLogicHandCodeHelper
    render: ($destination) ->
      $destination.append @$parent
      @textarea.render().attach_to @$parent
      @button.render().attach_to @$parent
      @button.bind_event 'click', () => @context.use_mode_selector_helper()
    serialize: () ->
      @textarea.$el.val() || @criteria
    constructor: (@criteria, @builder, @view_factory, @context) ->
      @$parent = $('<div>')
      @textarea = @view_factory.create_textarea @criteria, 'skiplogic__handcode-edit'
      @button = @view_factory.create_button '<i class="k-icon k-icon-trash"></i>', 'skiplogic-handcode__cancel'

  class skipLogicHelpers.SkipLogicModeSelectorHelper
    render: ($destination) ->
      $parent = $('<div>')
      $destination.append $parent
      @criterion_builder_button.render().attach_to $parent
      @handcode_button.render().attach_to $parent

      @criterion_builder_button.bind_event('click', () =>
        @context.view_factory.survey.trigger('change')
        @context.use_criterion_builder_helper()
      )
      @handcode_button.bind_event('click', () =>
        @context.view_factory.survey.trigger('change')
        @context.use_hand_code_helper()
      )

    serialize: () ->
      return ''
    constructor: (view_factory, @context) ->
      @criterion_builder_button = view_factory.create_button '<i>+</i> ' + t("Add a condition"), 'kobo-button kobo-button--green'
      @handcode_button = view_factory.create_button '<i>${}</i> ' + t("Manually enter your skip logic in XLSForm code"), 'kobo-button kobo-button--blue'
      ###@view = @view_factory.create_skip_logic_picker_view(context)###
    switch_editing_mode: () -> return

  operators =
    EXISTENCE: 1
    EQUALITY: 2
    GREATER_THAN: 3
    GREATER_THAN_EQ: 4
  ops =
    EX: operators.EXISTENCE
    EQ: operators.EQUALITY
    GT: operators.GREATER_THAN
    GE: operators.GREATER_THAN_EQ

  skipLogicHelpers.question_types =
    default:
      operators: [
        ops.EX #1
        ops.EQ #2
      ]
      equality_operator_type: 'text'
      response_type: 'text'
      name: 'default'
    select_one:
      operators: [
        ops.EQ #2
        ops.EX #1
      ]
      equality_operator_type: 'text'
      response_type: 'dropdown'
      name: 'select_one'
    select_multiple:
      operators: [
        ops.EQ #2
        ops.EX #1
      ]
      equality_operator_type: 'select_multiple'
      response_type: 'dropdown'
      name: 'select_multiple'
    integer:
      operators: [
        ops.GT #3
        ops.EX #1
        ops.EQ #2
        ops.GE #4
      ]
      equality_operator_type: 'basic'
      response_type: 'integer'
      name: 'integer'

    # rank:
    #   operators: [
    #     ops.EX #1
    #     ops.EQ #2
    #   ]
    #   equality_operator_type: 'select_multiple'
    #   response_type: 'dropdown'
    #   name: 'rank'
    # rank__item:
    #   operators: [
    #     ops.EX #1
    #     ops.EQ #2
    #   ]
    #   equality_operator_type: 'select_multiple'
    #   response_type: 'dropdown'
    #   name: 'rank_item'

    # score:
    #   operators: [
    #     ops.EX #1
    #     ops.EQ #2
    #   ]
    #   equality_operator_type: 'select_multiple'
    #   response_type: 'dropdown'
    #   name: 'score'
    # score__row:
    #   operators: [
    #     ops.EX #1
    #     ops.EQ #2
    #   ]
    #   equality_operator_type: 'select_multiple'
    #   response_type: 'dropdown'
    #   name: 'score_row'

    barcode:
      operators: [
        ops.GT #3
        ops.EX #1
        ops.EQ #2
        ops.GE #4
      ]
      equality_operator_type: 'text'
      response_type: 'text'
      name: 'barcode'
    decimal:
      operators: [
        ops.EX #1
        ops.EQ #2
        ops.GT #3
        ops.GE #4
      ]
      equality_operator_type: 'basic'
      response_type: 'decimal'
      name: 'decimal'
    geopoint:
      operators: [
        ops.EX #1
      ]
      name: 'geopoint'
    geotrace:
      operators: [
        ops.EX #1
      ]
      name: 'geotrace'
    geoshape:
      operators: [
        ops.EX #1
      ]
      name: 'geoshape'
    image:
      operators: [
        ops.EX #1
      ]
      name: 'image'
    audio:
      operators: [
        ops.EX #1
      ]
      name: 'audio'
    video:
      operators: [
        ops.EX #1
      ]
      name: 'video'
    acknowledge:
      operators: [
        ops.EX #1
      ]
      name: 'acknowledge'
    date:
      operators: [
        ops.EQ #2
        ops.GT #3
        ops.GE #4
      ]
      equality_operator_type: 'date'
      response_type: 'text'
      name: 'date'


  skipLogicHelpers.operator_types = [
    {
      id: 1
      type: 'existence'
      label: t("Was Answered")
      negated_label: t("Was not Answered")
      abbreviated_label: t("Was Answered")
      abbreviated_negated_label: t("Was not Answered")
      parser_name: ['ans_notnull','ans_null']
      symbol: {
        ans_notnull: '!=',
        ans_null: '='
      }
      response_type: 'empty'
    }
    {
      id: 2
      type: 'equality'
      label: ''
      negated_label: t("not")
      abbreviated_label: '='
      abbreviated_negated_label: '!='
      parser_name: ['resp_equals', 'resp_notequals', 'multiplechoice_selected', 'multiplechoice_notselected']
      symbol: {
        resp_equals: '=',
        resp_notequals: '!=',
        multiplechoice_selected: '='
        multiplechoice_notselected: '!='
      }
    }
    {
      id: 3
      type: 'equality'
      label: t("Greater Than")
      negated_label: t("Less Than")
      abbreviated_label: '>'
      abbreviated_negated_label: '<'
      parser_name: ['resp_greater', 'resp_less']
      symbol: {
        resp_greater: '>'
        resp_less: '<'
      }
    }
    {
      id: 4
      type: 'equality'
      label: t("Greater Than or Equal to")
      negated_label: t("Less Than or Equal to")
      abbreviated_label: '>='
      abbreviated_negated_label: '<='
      parser_name: ['resp_greaterequals', 'resp_lessequals']
      symbol: {
        resp_greaterequals: '>=',
        resp_lessequals: '<='
      }
    }
  ]

  skipLogicHelpers
