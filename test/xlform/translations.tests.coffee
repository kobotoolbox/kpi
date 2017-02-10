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

    expect(survey1._translation_1).toEqual(null)
    expect(survey1._translation_2).toEqual(undefined)

    expect(survey2._translation_1).toEqual(null)
    expect(survey2._translation_2).toEqual(undefined)

  it 'does not have active_translation_name value when none set', ->
    survey_json = process(
        survey: [type: "text", label: ["VAL1"], name: "val1"]
        translations: [null]
      ).toJSON()
    expect(survey_json['#active_translation_name']).toBeUndefined()

  it 'passes thru active_translation_name', ->
    survey = process(
        survey: [
            type: "text"
            label: ["VAL1_NULL", "VAL2_L2"],
            name: "val1",
          ]
        translations: [null, "L2"]
        '#active_translation_name': 'XYZ'
      )
    expect(survey.active_translation_name).toEqual('XYZ')
    _json = survey.toJSON()
    expect(_json['#active_translation_name']).toEqual('XYZ')

  it 'fails with invalid active_translation_name', ->
    run = ->
      survey = process(
          survey: [
              type: "text"
              label: ["VAL1_NULL", "VAL2_L2"],
              name: "val1",
            ]
          translations: ["L1", "L2"]
          '#active_translation_name': 'XYZ'
        )
    # "#active_translation_name" is set, but refers to a value in "translations"
    # but in this case there is no null in the translations list so it should
    # throw an error
    expect(run).toThrow()

  it 'example 1', ->
    survey = process(
        survey: [
            type: "text"
            label: ["VAL1_NULL", "VAL2_L2"],
            name: "val1",
          ]
        translations: [null, "L2"]
      )
    expect(survey._translation_1).toEqual(null)
    expect(survey._translation_2).toEqual("L2")
    r0 = survey.rows.at(0)
    expect(r0.getLabel('_1')).toEqual('VAL1_NULL')
    expect(r0.getLabel('_2')).toEqual('VAL2_L2')

    rj0 = survey.toJSON().survey[0]
    expect(rj0['label']).toBeDefined()
    expect(rj0['label::L2']).toBeDefined()

  it 'example 2', ->
    survey = process(
        survey: [
            type: "text"
            label: ["VAL1_L1", "VAL2_L2"],
            name: "val1",
          ]
        translations: ["L1", "L2"]
      )
    src = $inputParser.parse(
        survey: [
            type: "text"
            label: ["VAL1_L1", "VAL2_L2"],
            name: "val1",
          ]
        translations: ["L1", "L2"]
      )
    expect(src['_active_translation_name']).toEqual("L1")
    expect(src.translations[0]).toEqual(null)

    expect(survey._translation_2).toEqual("L2")
    _sjson = survey.toJSON()

    r0 = survey.rows.at(0)
    expect(r0.getLabel('_1')).toEqual('VAL1_L1')
    expect(r0.getLabel('_2')).toEqual('VAL2_L2')

    rj0 = _sjson.survey[0]
    expect(rj0['label']).toBeDefined()
    expect(rj0['label::L2']).toBeDefined()
    expect(_sjson['#active_translation_name']).toEqual('L1')

  it 'example 3', ->
    run = ->
      survey = process(
        survey: [
            type: "text"
            label: ["VAL1_L2", "VAL2_NULL"],
            name: "val1",
          ]
        translations: ["L2", null]
      )
    # run()
    expect(run).toThrow('translations need to be reordered')

