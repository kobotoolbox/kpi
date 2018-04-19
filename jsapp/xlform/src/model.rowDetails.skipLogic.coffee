###
painstakingly reverse-compiled from this file in dkobo:
https://github.com/kobotoolbox/dkobo/blob/225ca1/dkobo/koboform/static/js/xlform/rowDetailsSkipLogic.model.rowDetails.skipLogic.coffee
###

_ = require 'underscore'
Backbone = require 'backbone'
$utils = require './model.utils'
$skipLogicHelpers = require './mv.skipLogicHelpers'

rowDetailsSkipLogic = {}

class rowDetailsSkipLogic.SkipLogicFactory
  create_operator: (type, symbol, id) ->
    switch type
      when 'text' then operator = new rowDetailsSkipLogic.TextOperator symbol
      when 'date' then operator = new rowDetailsSkipLogic.DateOperator symbol
      when 'basic' then operator = new rowDetailsSkipLogic.SkipLogicOperator symbol
      when 'existence' then operator = new rowDetailsSkipLogic.ExistenceSkipLogicOperator symbol
      when 'select_multiple' then operator = new rowDetailsSkipLogic.SelectMultipleSkipLogicOperator symbol
      when 'empty' then return new rowDetailsSkipLogic.EmptyOperator()
    operator.set 'id', id
    operator
  create_criterion_model: () ->
    new rowDetailsSkipLogic.SkipLogicCriterion(@, @survey)
  create_response_model: (type) ->
    model = null
    switch type
      when 'integer' then model = new rowDetailsSkipLogic.IntegerResponseModel
      when 'decimal' then model = new rowDetailsSkipLogic.DecimalResponseModel
      else model = new rowDetailsSkipLogic.ResponseModel(type)
    model.set 'type', type
  constructor: (@survey) ->

class rowDetailsSkipLogic.SkipLogicCriterion extends Backbone.Model
  serialize: () ->
    response_model = @get('response_value')

    if `response_model != null && this.get('operator') != null && this.get('question_cid') != null && response_model.isValid() !== false && response_model.get('value') != null && this._get_question()`
      @_get_question().finalize()
      `var questionName = this._get_question().getValue('name')`
      return @get('operator').serialize(questionName, response_model.get('value'))
    else
      return ''
  _get_question: () ->
    @survey.findRowByCid(this.get('question_cid'), { includeGroups: true })


  change_question: (cid) ->
    # old_question_type = this._get_question()?.get_type() or { name: null }
    # # compiles incorrectly (extra != null)
    # - old_question_type = ((_ref = this._get_question()) != null ? _ref.get_type() : void 0) || { name: null };
    # + old_question_type = ((_ref = this._get_question()) ? _ref.get_type() : void 0) || { name: null };
    # old_question_type = @neverDefined?.increment_coffee_ref()
    # old_question_type = (if `this._get_question()` then this._get_question().get_type()) or { name: null }
    old_question_type = @_get_question()?.get_type?() or { name: null }
    @set('question_cid', cid)
    question_type = @_get_question().get_type()

    if @get('operator').get_id() not in question_type.operators
      @change_operator question_type.operators[0]
    else if old_question_type.name != question_type.name
      @change_operator @get('operator').get_value()

    if !@get('operator').get_type().response_type? && @_get_question().response_type != @get('response_value')?.get_type()
      return `this.change_response((response_model = this.get('response_value')) != null ? this._get_question()._isSelectQuestion() ? response_model.get('cid') : response_model.get('value') : '')`
  change_operator: (operator) ->
    operator = +operator
    is_negated = false
    if operator < 0
      is_negated = true
      operator *=-1

    question_type = @_get_question().get_type()

    if !(operator in question_type.operators)
      return

    type = $skipLogicHelpers.operator_types[operator - 1]
    symbol = type.symbol[type.parser_name[+is_negated]]
    operator_model = @factory.create_operator (if type.type == 'equality' then question_type.equality_operator_type else type.type), symbol, operator
    @set('operator', operator_model)

    if (type.response_type || question_type.response_type) != @get('response_value')?.get('type')
      # -        return this.change_response(((_ref1 = this.get('response_value')) != null ?
      # +        return this.change_response(((_ref1 = this.get('response_value')) != null ?
      # -           _ref1.get(this._get_question()._isSelectQuestion() ? 'cid' : 'value')
      # -             : void 0) || '');
      # +           this._get_question()._isSelectQuestion() ? _ref1.get('cid') : _ref1.get('value')
      # +             : void 0) || '');
      @change_response @get('response_value')?.get(if @_get_question()._isSelectQuestion() then 'cid' else 'value') or ''
  get_correct_type: () ->
    @get('operator').get_type().response_type || @_get_question().get_type().response_type

  set_option_names: (options) ->
    _.each(options, (model)->
      if (`model.get('name') == null`)
        model.set('name', $utils.sluggify(model.get('label')))
    )
    ``

  change_response: (value) ->
    response_model = @get('response_value')
    if !response_model || response_model.get('type') != @get_correct_type()
      response_model = @factory.create_response_model @get_correct_type()
      @set('response_value', response_model)

    if @get_correct_type() == 'dropdown'
      current_value = `response_model ? response_model.get('cid') : null`
      `var choicelist = this._get_question().getList()`
      response_model.set('choicelist', choicelist)
      choices = choicelist.options.models
      this.set_option_names(choices)

      # current_value = response_model?.get('value')
      # choices = @_get_question().getList().options.models

      # _.each choices, (model) ->
      #   if !model.get('name')?
      #     model.set('name', rowDetailsSkipLogic.sluggify model.get 'label')

      choice_cids = _.map(choices, (model) -> model.cid)

      if value in choice_cids
        response_model.set_value value
      else if current_value in choice_cids
        response_model.set_value current_value
      else
        response_model.set_value choices[0].cid
    else
      response_model.set_value(value)
  constructor: (@factory, @survey) ->
    super()


class rowDetailsSkipLogic.Operator extends Backbone.Model
  serialize: (question_name, response_value) ->
    throw new Error("Not Implemented")
  get_value: () ->
    val = ''
    if @get 'is_negated'
      val = '-'
    val + @get 'id'
  get_type: () ->
    $skipLogicHelpers.operator_types[@get('id') - 1]
  get_id: () ->
    @get 'id'

class rowDetailsSkipLogic.EmptyOperator extends rowDetailsSkipLogic.Operator
  serialize: () -> ''
  constructor: () ->
    super()
    @set 'id', 0
    @set 'is_negated', false

class rowDetailsSkipLogic.SkipLogicOperator extends rowDetailsSkipLogic.Operator
  serialize: (question_name, response_value) ->
    return '${' + question_name + '} ' + @get('symbol') + ' ' + response_value
  constructor: (symbol) ->
    super()
    @set('symbol', symbol)
    this.set('is_negated', [
      '!=',
      '<',
      '<=',
    ].indexOf(symbol) > -1)
    # @set('is_negated', symbol == '!=')

class rowDetailsSkipLogic.TextOperator extends rowDetailsSkipLogic.SkipLogicOperator
  serialize: (question_name, response_value) ->
    return super(question_name, "'" + response_value.replace(/'/g, '\\\'') + "'")

class rowDetailsSkipLogic.DateOperator extends rowDetailsSkipLogic.SkipLogicOperator
  serialize: (question_name, response_value) ->
    if `response_value.indexOf('date') == -1`
      response_value = 'date(\'' + response_value + '\')';
    return super(question_name, response_value)

class rowDetailsSkipLogic.ExistenceSkipLogicOperator extends rowDetailsSkipLogic.SkipLogicOperator
  serialize: (question_name) ->
    return super(question_name, "''")
  constructor: (operator) ->
    super(operator)
    @set('is_negated', operator == '=')

class rowDetailsSkipLogic.SelectMultipleSkipLogicOperator extends rowDetailsSkipLogic.SkipLogicOperator
  serialize: (question_name, response_value) ->
    selected = "selected(${" + question_name + "}, '" + response_value + "')"

    if @get('is_negated')
      return 'not(' + selected + ')'
    return selected

class rowDetailsSkipLogic.ResponseModel extends Backbone.Model
  constructor: (type)->
    super()
    if type is 'dropdown'
      @_set_value = @set_value
      @set_value = (cid)->
        choice = @get('choicelist').options.get(cid)
        if choice
          @_set_value(choice.get('name'))
          @set('cid', cid)
        ``
  get_type: () ->
    return @get('type')
  set_value: (value) ->
    @set('value', value, validate: true)

class rowDetailsSkipLogic.IntegerResponseModel extends rowDetailsSkipLogic.ResponseModel
  validation:
    value:
      pattern: /^-?\d+$/
      msg: 'Number must be integer'
  set_value: (value)->
    if value is ''
      value = `undefined`
    this.set 'value', value, validate: !!value

class rowDetailsSkipLogic.DecimalResponseModel extends rowDetailsSkipLogic.ResponseModel
  validation:
    value:
      pattern: 'number'
      msg: 'Number must be decimal'
  set_value: (value) ->
    `function value_is_not_number() {
      return typeof value !== 'number';
    }`

    if typeof value is 'undefined' or value is ''
      value = null
    else
      if value_is_not_number()
        value = value.replace(/\s/g, '')
        value = +value || value

      if value_is_not_number()
        value = +value.replace(',', '.') || value

      if value_is_not_number()
        if value.lastIndexOf(',') > value.lastIndexOf('.')
          value = +value.replace(/\./g, '').replace(',', '.')
        else
          value = +value.replace(',', '')

      # if value.lastIndexOf(',') > value.lastIndexOf('.')
      #   final_value = +(value.replace(/\./g, '').replace(',', '.'))
      # else
      #   final_value = +(value.replace(',', ''))
    @set('value', value, validate: true)

class rowDetailsSkipLogic.DateResponseModel extends rowDetailsSkipLogic.ResponseModel
  validation:
    value:
      pattern: /date\(\'\d{4}-\d{2}-\d{2}\'\)/
  set_value: (value) ->
    if /^\d{4}-\d{2}-\d{2}$/.test(value)
      value = "date('" + value + "')"
    @set('value', value, validate: true)

module.exports = rowDetailsSkipLogic
