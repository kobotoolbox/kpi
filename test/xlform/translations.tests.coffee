{expect} = require('../helper/fauxChai')

$inputParser = require("../../jsapp/xlform/src/model.inputParser")
$survey = require("../../jsapp/xlform/src/model.survey")

describe " translations set proper values ", ->
  process = (src)->
    parsed = $inputParser.parse(src)
    new $survey.Survey(parsed)

  it 'example 0', ->
    survey1 = process(
        survey: [
            type: "text"
            label: "VAL1",
            name: "val1",
          ]
      )
    survey2 = process(
        survey: [
            type: "text"
            label: ["VAL1"],
            name: "val1",
          ]
        translations: [null]
      )

    expect(survey1._preferred_translation).toEqual(null)
    expect(survey1._secondary_translation).toEqual(undefined)

    expect(survey2._preferred_translation).toEqual(null)
    expect(survey2._secondary_translation).toEqual(undefined)

  it 'does not have null_translation value when none set', ->
    survey_json = process(
        survey: [type: "text", label: ["VAL1"], name: "val1"]
        translations: [null]
      ).toJSON()
    expect(survey_json['#null_translation']).toBeUndefined()

  it 'passes thru null_translation', ->
    survey = process(
        survey: [
            type: "text"
            label: ["VAL1_NULL", "VAL2_L2"],
            name: "val1",
          ]
        translations: [null, "L2"]
        '#null_translation': 'XYZ'
      )
    expect(survey.null_translation).toEqual('XYZ')
    _json = survey.toJSON()
    expect(_json['#null_translation']).toEqual('XYZ')

  it 'example 1', ->
    survey = process(
        survey: [
            type: "text"
            label: ["VAL1_NULL", "VAL2_L2"],
            name: "val1",
          ]
        translations: [null, "L2"]
      )
    expect(survey._preferred_translation).toEqual(null)
    expect(survey._secondary_translation).toEqual("L2")
    r0 = survey.toJSON().survey[0]
    expect(r0['label']).toBeDefined()
    expect(r0['label::L2']).toBeDefined()

  it 'example 2', ->
    survey = process(
        survey: [
            type: "text"
            label: ["VAL1_L1", "VAL2_L2"],
            name: "val1",
          ]
        translations: ["L1", "L2"]
      )
    expect(survey._preferred_translation).toEqual("L1")
    expect(survey._secondary_translation).toEqual("L2")
    r0 = survey.toJSON().survey[0]
    expect(r0['label::L1']).toBeDefined()
    expect(r0['label::L2']).toBeDefined()
    expect(r0.label).toBeUndefined()

  it 'example 3', ->
    survey = process(
      survey: [
          type: "text"
          label: ["VAL1_L2", "VAL2_NULL"],
          name: "val1",
        ]
      translations: ["L2", null]
    )
    expect(survey._preferred_translation).toEqual("L2")
    expect(survey._secondary_translation).toEqual(null)
    r0 = survey.toJSON().survey[0]
    expect(r0['label::L2']).toBeDefined()
    expect(r0['label']).toBeDefined()

