_ = require 'underscore'
$skipLogicView = require './view.rowDetail.SkipLogic'
$viewWidgets = require './view.widgets'
$skipLogicHelpers = require './mv.skipLogicHelpers'

module.exports = do ->
  viewRowDetailValidationLogic = {}
  class viewRowDetailValidationLogic.ValidationLogicViewFactory extends $skipLogicView.SkipLogicViewFactory
    create_criterion_builder_view: () ->
      return new viewRowDetailValidationLogic.ValidationLogicCriterionBuilder()
    create_question_picker: () ->
      return new viewRowDetailValidationLogic.ValidationLogicQuestionPicker
    create_operator_picker: (question_type) ->
      operators = _.filter($skipLogicHelpers.operator_types, (op_type) -> op_type.id != 1 && op_type.id in question_type.operators)
      return new $skipLogicView.OperatorPicker operators

  class viewRowDetailValidationLogic.ValidationLogicCriterionBuilder extends $skipLogicView.SkipLogicCriterionBuilderView
    render: () ->
      super()
      @$el.html(@$el.html().replace 'only be displayed', 'be valid only')

      @

  class viewRowDetailValidationLogic.ValidationLogicQuestionPicker extends $viewWidgets.Label
    constructor: () ->
      super("This question's response has to be")
    attach_to: (target) ->
      target.find('.skiplogic__rowselect').remove()
      super(target)

  viewRowDetailValidationLogic
