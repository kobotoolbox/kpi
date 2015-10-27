Backbone = require 'backbone'
$skipLogicModel = require './model.rowDetails.skipLogic'

module.exports = do ->
  rowDetailValidationLogic = {}
  class rowDetailValidationLogic.ValidationLogicModelFactory extends $skipLogicModel.SkipLogicFactory
    create_operator: (type, symbol, id) ->
      operator = null
      switch type
        when 'text' then operator = new rowDetailValidationLogic.ValidationLogicTextOperator symbol
        when 'date' then operator = new rowDetailValidationLogic.ValidationLogicDateOperator symbol
        when 'basic' then operator = new rowDetailValidationLogic.ValidationLogicBasicOperator symbol
        when 'existence' then operator = new rowDetailValidationLogic.ValidationLogicExistenceOperator symbol
        when 'select_multiple' then operator = new rowDetailValidationLogic.ValidationLogicSelectMultipleOperator symbol
        when 'empty' then return new $skipLogicModel.EmptyOperator()

      operator.set 'id', id
      return operator
    create_criterion_model: () ->
      new rowDetailValidationLogic.ValidationLogicCriterion(@, @survey)

  class rowDetailValidationLogic.ValidationLogicBasicOperator extends $skipLogicModel.SkipLogicOperator
    serialize: (question_name, response_value) ->
      return '. ' + this.get('symbol') + ' ' + response_value
  class rowDetailValidationLogic.ValidationLogicTextOperator extends rowDetailValidationLogic.ValidationLogicBasicOperator
    serialize: (question_name, response_value) ->
      return super '', ' ' + "'" + response_value.replace(/'/g, "\\'") + "'"
  class rowDetailValidationLogic.ValidationLogicDateOperator extends rowDetailValidationLogic.ValidationLogicBasicOperator
    serialize: (question_name, response_value) ->
      if response_value.indexOf('date') == -1
        response_value = "date('" + response_value + "')"
      return super '', ' ' + response_value
  class rowDetailValidationLogic.ValidationLogicExistenceOperator extends rowDetailValidationLogic.ValidationLogicBasicOperator
    serialize: () ->
      return super '', "''"
  class rowDetailValidationLogic.ValidationLogicSelectMultipleOperator extends $skipLogicModel.SelectMultipleSkipLogicOperator
    serialize: (question_name, response_value) ->
      selected = "selected(., '" + response_value + "')"
      if this.get 'is_negated'
          return 'not(' + selected + ')'
      return selected

  class rowDetailValidationLogic.ValidationLogicCriterion extends $skipLogicModel.SkipLogicCriterion
    change_question: (cid) ->
      old_question_type = if @_get_question() then @_get_question().get_type() else name: null
      @set "question_cid", cid
      question_type = @_get_question().get_type()

      if @get("operator").get_id()? && !(@get("operator").get_id() in question_type.operators)
        @change_operator if question_type.operators[0] != 1 then question_type.operators[0] else question_type.operators[1]
      else if old_question_type.name != question_type.name
        @change_operator @get("operator").get_value()
      if (@get("operator").get_type().response_type == null) && @_get_question().response_type != @get("response_value")?.get_type()
        @change_response @get("response_value").get("value")

  rowDetailValidationLogic
