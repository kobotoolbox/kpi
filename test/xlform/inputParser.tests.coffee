{expect} = require('../helper/fauxChai')

$inputParser = require("../../jsapp/xlform/src/model.inputParser")
$choices = require("../../jsapp/xlform/src/model.choices")
$surveys = require("../fixtures/xlformSurveys")

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
      describe ' translated surveys', ->
        it 'flattens translated lists 1', ->
          results = $inputParser.parseArr('survey', [
              {type: 'text', name: 'q1', label: ['q1x', 'q1null']},
              {type: 'text', name: 'q2', label: ['q2x', 'q2null']},
            ], ['lx', null])
          expect(results).toEqual([
              {
                type: 'text', name: 'q1',
                'label::lx': 'q1x',
                'label': 'q1null',
              },
              {
                type: 'text', name: 'q2',
                'label::lx': 'q2x',
                'label': 'q2null',
              },
            ])

        it 'flattens translated lists 2', ->
          translations = ['lx', 'ly']
          results = $inputParser.parseArr('survey', [
              {type: 'text', name: 'q1', label: ['q1x', 'q1y']},
              {type: 'text', name: 'q2', label: ['q2x', 'q2y']},
            ], translations)

          expected = [
              {
                type: 'text', name: 'q1',
                'label::lx': 'q1x',
                'label::ly': 'q1y',
              },
              {
                type: 'text', name: 'q2',
                'label::lx': 'q2x',
                'label::ly': 'q2y',
              },
            ]
          for i in [0, 1]
            expect(results[i]).toEqual(expected[i])

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
            {type: 'begin group', name: 'grp1', '$kuid': 'aaa'},
            {type: 'begin group', name: 'grp2', '$kuid': 'bbb'},
            {type: 'text', name: 'q1', '$kuid': 'ccc'},
            {type: 'text', name: 'q2', '$kuid': 'ddd'},
            {type: 'end group', '$kuid': 'eee'},
            {type: 'end group', '$kuid': 'fff'},
          ])
        expect(results).toEqual([{
          type : 'group',
          name : 'grp1',
          '$kuid': 'aaa',
          __rows : [
            {type: 'group',
            name : 'grp2',
            '$kuid': 'bbb',
            __rows : [
              { type : 'text', name : 'q1', '$kuid': 'ccc' },
              { type : 'text', name : 'q2', '$kuid': 'ddd' }
            ]}]}])
      it 'parses non-grouped list of questions', ->
        results = $inputParser.parseArr('survey', [
            {type: 'text', name: 'q1'},
            {type: 'text', name: 'q2'},
          ])
        expect(results).toEqual([ { type : 'text', name : 'q1' }, { type : 'text', name : 'q2' } ])
