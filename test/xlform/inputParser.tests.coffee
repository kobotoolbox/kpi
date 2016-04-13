{expect} = require('../helper/fauxChai')

$inputParser = require("../../jsapp/xlform/src/model.inputParser")
$choices = require("../../jsapp/xlform/src/model.choices")
$surveys = require("../fixtures/surveys")

do ->
  describe '" $inputParser', ->
    beforeEach ->
      @sampleSurveyObj =
        survey: [
          key1: "val1"
          key2: "val2"
          key3: "val3"
        ]
        choices: [
          k4: "v4"
          k5: "v5"
        ]
    describe '. loadChoiceLists()"', ->
      list = new $choices.ChoiceList()
      $inputParser.loadChoiceLists($surveys.pizza_survey.main().choices, list)

    describe '. parse()"', ->
      it 'parses group hierarchy', ->
        results = $inputParser.parseArr('survey', [
            {type: 'begin group', name: 'grp1'},
            {type: 'text', name: 'q1'},
            {type: 'end group'},
          ])
        expect(results).toEqual([
            {
              type: 'group',
              name: 'grp1',
              __rows: [{type: 'text', name: 'q1'}]
            }
          ])
      it 'parses scoring questions', ->
        results = $inputParser.parseArr('survey', [
            {"type": "begin score", "name": "koboskore", "label": "Label"},
            {"type": "end score"},
          ])
        expect(results).toEqual([
            {
              type: 'score',
              name: 'koboskore',
              label: 'Label',
              __rows: []
            }
          ])

      it 'parses nested groups hierarchy', ->
        results = $inputParser.parseArr('survey', [
            {type: 'begin group', name: 'grp1'},
            {type: 'begin group', name: 'grp2'},
            {type: 'text', name: 'q1'},
            {type: 'text', name: 'q2'},
            {type: 'end group'},
            {type: 'end group'},
          ])
        expect(results).toEqual([ { type : 'group', name : 'grp1', __rows : [ { type : 'group', name : 'grp2', __rows : [ { type : 'text', name : 'q1' }, { type : 'text', name : 'q2' } ] } ] } ])
      it 'parses non-grouped list of questions', ->
        results = $inputParser.parseArr('survey', [
            {type: 'text', name: 'q1'},
            {type: 'text', name: 'q2'},
          ])
        expect(results).toEqual([ { type : 'text', name : 'q1' }, { type : 'text', name : 'q2' } ])
