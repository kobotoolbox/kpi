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
      ,integer,age_int,Age (Integer field),,
      ,note,note_int_valid,You are under 18 (Integer check),,${age_int} < 18
      ,text,age_text,Age (Text field with numbers appearance),numbers,
      ,note,note_text_less,You are under 18 (Text < check),,${age_text} < 18
      ,note,note_text_greater,You are over 18 (Text > check),,${age_text} > 18
      ,note,note_text_geq,You are 18 or older (Text >= check),,${age_text} >= 18
    """
    @survey = $model.Survey.load(TEST_SURVEY)
    @model_factory = new $rowDetailsSkipLogic.SkipLogicFactory(@survey)
    @view_factory = new $skipLogicView.SkipLogicViewFactory(@survey)
    @helper_factory = new $skipLogicHelpers.SkipLogicHelperFactory(@model_factory, @view_factory, @survey, @survey.rows.at(0), '')
    @builder = @helper_factory.create_builder()

  it "allows relational operators for integer fields", ->
    # Integer fields support relational operators like <, >, >=, <=
    # The builder should succeed and return criteria rather than false
    result = @builder.build_criterion_builder("age_int < 18")
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)

  it "falls back to hand coded logic when text fields use relational operators", ->
    result = @builder.build_criterion_builder("age_text < 18")
    expect(result).toBe(false)

  it "falls back to hand coded logic when text fields use greater-than operator", ->
    result = @builder.build_criterion_builder("age_text > 18")
    expect(result).toBe(false)

  it "falls back to hand coded logic when text fields use greater-than-or-equal operator", ->
    result = @builder.build_criterion_builder("age_text >= 18")
    expect(result).toBe(false)
