{expect} = require('../helper/fauxChai')
_ = require 'underscore'

$model = require("../../jsapp/xlform/src/_model")
$skipLogicHelpers = require("../../jsapp/xlform/src/mv.skipLogicHelpers.coffee")
$skipLogicView = require("../../jsapp/xlform/src/view.rowDetail.SkipLogic.coffee")
$rowDetailsSkipLogic = require("../../jsapp/xlform/src/model.rowDetails.skipLogic.coffee")

describe "SkipLogicBuilder", ->
  beforeEach ->
    TEST_SURVEY = """
      survey,,,,,
      ,type,name,label,appearance,relevant
      ,integer,age_int,Age (Integer question),,
      ,text,age_text,Age (Text question with numbers appearance),numbers,
      ,note,note_int_valid,You are under 18 (Integer check),,${age_int} < 18
      ,note,note_text_less,You are under 18 (Text < check),,${age_text} < 18
      ,note,note_text_greater,You are over 18 (Text > check),,${age_text} > 18
      ,note,note_text_geq,You are 18 or older (Text >= check),,${age_text} >= 18
    """
    @survey = $model.Survey.load(TEST_SURVEY)
    @model_factory = new $rowDetailsSkipLogic.SkipLogicFactory(@survey)
    @view_factory = new $skipLogicView.SkipLogicViewFactory(@survey)
    # Use the note question (3rd row, index 2) as the current question so we can reference age_int and age_text
    @helper_factory = new $skipLogicHelpers.SkipLogicHelperFactory(@model_factory, @view_factory, @survey, @survey.rows.at(2), '')
    @builder = @helper_factory.create_builder()

  it "allows relational operators for integer questions and builds proper criteria", ->
    # Integer fields DO support relational operators like <, >, >=
    # The builder should return [criteria_array, operator_string] instead of false
    result = @builder.build_criterion_builder("${age_int} < 18")
    # Success case: should return [criteria_array, operator_string]
    # If unsupported, returns false
    expect(Array.isArray(result) && result[0] && result[0].length > 0).toBe(true)
    expect(result[1]).toBe(undefined)  # Single criterion has no join operator

  it "allows greater-than operator for integer questions", ->
    result = @builder.build_criterion_builder("${age_int} > 18")
    expect(Array.isArray(result) && result[0] && result[0].length > 0).toBe(true)

  it "allows greater-than-or-equal operator for integer questions", ->
    result = @builder.build_criterion_builder("${age_int} >= 18")
    expect(Array.isArray(result) && result[0] && result[0].length > 0).toBe(true)

  it "falls back to hand coded logic when text questions use relational operators", ->
    # Text questions do NOT support <, >, >=, <= operators
    # The fallback should trigger (return false) instead of corrupting the logic
    result = @builder.build_criterion_builder("${age_text} < 18")
    expect(result).toBe(false)

  it "falls back to hand coded logic when text questions use greater-than operator", ->
    result = @builder.build_criterion_builder("${age_text} > 18")
    expect(result).toBe(false)

  it "falls back to hand coded logic when text questions use greater-than-or-equal operator", ->
    result = @builder.build_criterion_builder("${age_text} >= 18")
    expect(result).toBe(false)
