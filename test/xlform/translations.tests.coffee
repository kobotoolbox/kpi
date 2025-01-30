import {expect} from '../helper/fauxChai'

import $inputParser from "../../jsapp/xlform/src/model.inputParser"
import $survey from "../../jsapp/xlform/src/model.survey"

describe("translations", ->
  process = (src) ->
    parsed = $inputParser.parse(src)
    new $survey.Survey(parsed)

  it('should not allow editing form with unnamed translation', ->
    run = ->
      survey = process(
        survey: [
          type: "text"
          label: ["Ciasto?", "Pizza?"],
          name: "Pizza survey",
        ]
        translations: ["polski (pl)", null]
      )
    expect(run).toThrow("""
      There is an unnamed translation in your form definition.
      Please give a name to all translations in your form.
      Use "Manage Translations" option from form landing page.
    """)
  )
)
