{expect} = require('../helper/fauxChai')

$survey = require("../../jsapp/xlform/src/model.survey")
$choices = require("../../jsapp/xlform/src/model.choices")
_ = require "underscore"
$surveyFixtures = require("../fixtures/xlformSurveys")
window._ = _

module.exports = do ->
  describe 'model.choices', ->
    beforeEach ->
      @survey = $survey.Survey.load({
          survey: [
            {
              type: 'select_one yes_no',
              name: 'yes_or_no',
              label: 'Yes or no?'
            }
          ],
          choices: [
            {
              'list name': 'yes_no',
              name: 'yes',
              label: 'Yes'
            },
            {
              'list name': 'yes_no',
              name: 'no',
              label: 'No'
            }
          ]
        })
      @choices = @survey.choices
      @yesno = @choices.get('yes_no')

    it 'has options in list', ->
      expect(@yesno.options.length).toBe(2)
    it 'can add option to a choice list', ->
      @yesno.options.add(name: 'maybe', label: 'Maybe')
      expect(@yesno.options.length).toBe(3)
    it 'can remove option from a choice list', ->
      opt = @yesno.options.find (o)-> o.get('name') is 'yes'
      expect(opt).toBeDefined()
      expect(@yesno.options.length).toBe(2)
      @yesno.options.remove(opt)
      expect(@yesno.options.length).toBe(1)

    it 'exports choice list properly', ->
      expect(@choices.toJSON()).toEqual([
          {
              name: "yes_no",
              options: [
                  {
                      name: "yes",
                      label: "Yes"
                  },
                  {
                      name: "no",
                      label: "No"
                  }
              ]
          }
      ])

    describe 'model.choices--CASCADES', ->
      it 'cascade choice list utility methods work', ->
        survey = $survey.Survey.load($surveyFixtures.cascading)
        expect(survey.choices.models.map((cl)->
            cl.get('name')
          )).toEqual(['state', 'county', 'city'])
        expect(survey.choices.models.map((cl)->
            cl._get_last_linked_choice_list().get('name')
          )).toEqual(['city', 'city', 'city'])
        expect(survey.choices.models.map((cl)->
            cl._get_first_linked_choice_list().get('name')
          )).toEqual(['state', 'state', 'state'])

        _city_choicelist = survey.choices.get('city')
        expect(_city_choicelist.get('name')).toBe('city')
        expect(_city_choicelist._has_corresponding_row()).toEqual(false)
        row_data = _city_choicelist._create_corresponding_row_data({
            _full_path_choice_filter: true
          })
        expect(row_data).toEqual([
            {
                "label": "state",
                "type": "select_one state",
                "choice_filter": ""
            },
            {
                "label": "county",
                "type": "select_one county",
                "choice_filter": "state=${state}"
            },
            {
                "label": "city",
                "type": "select_one city",
                "choice_filter": "state=${state} and county=${county}"
            },
          ])
        row_data = _city_choicelist._create_corresponding_row_data({
            _full_path_choice_filter: false
          })
        expect(row_data).toEqual([
            {
                "label": "state",
                "type": "select_one state",
                "choice_filter": ""
            },
            {
                "label": "county",
                "type": "select_one county",
                "choice_filter": "state=${state}"
            },
            {
                "label": "city",
                "type": "select_one city",
                "choice_filter": "county=${county}"
            },
          ])

      it 'imports a survey with a cascading choice list', ->
        survey = $survey.Survey.load($surveyFixtures.cascading)
        _city_choicelist = survey.choices.get('city')
        for choiceList in survey.choices.models
          expect(choiceList._has_corresponding_row()).toEqual(false)

        _city_choicelist.create_corresponding_rows()

        for choiceList in survey.choices.models
          expect(choiceList._has_corresponding_row()).toEqual(true)

        row0 = survey.rows.at(0)
        row2 = survey.rows.at(2)
        expect(survey.toCsvJson().choices.rowObjects.map(((r)->
            return "#{r.list_name}-#{r.name}"
          )).sort()).toEqual(["city-brownsville", "city-dumont", "city-finney",
              "city-harlingen", "city-puyallup", "city-redmond", "city-seattle",
              "city-tacoma", "county-cameron", "county-king", "county-king", #2 kings
              "county-pierce", "state-texas", "state-washington"])
        expect(survey.toCsvJson().survey.rowObjects.map(((r)->
            return "#{r.type}-#{r.name}"
          ))).toEqual(["select_one state-state",
                        "select_one county-county",
                        "select_one city-city",
                        "start-start",
                        "end-end"])
        expect(row2.getList().get("name")).toBe("city")
        expect(row2.getList().getList).toBeDefined()
        expect(row2.getList().getList()).not.toBe(null)
        expect(row2.getList().getList().get("name")).toBe("county")
        expect(row2.getList().getList().getList().get("name")).toBe("state")
        # console.log($survey.Survey.load(survey.toSsStructure())
        #                                         .toSsStructure())

        # Do we want to get survey.toJSON() working?
        # it has largely been replaced by survey.toSsStructure()
        # expect(_.keys(survey.toJSON().choices).sort()).toEqual([
        #     "city", "county", "state",
        #   ])


    describe 'Choicelist', ->
      describe 'Clone method', ->
        it 'Clones itself and all of its options', ->
          yesnoClone = @yesno.clone()
          # cloned choiceList must be available
          # to get current translation. so this test
          # will fail in the same way the clone button
          # fails on questions with choice lists
          surv = yesnoClone.getSurvey()

          expect(yesnoClone.options.length).toBe 2
          expect(yesnoClone.options.at(0).get('name')).toBe 'yes'
          expect(yesnoClone.options.at(1).get('name')).toBe 'no'
          expect(yesnoClone.cid).not.toEqual @yesno.cid
          expect(yesnoClone.get('name')).not.toBe @yesno.get('name')
