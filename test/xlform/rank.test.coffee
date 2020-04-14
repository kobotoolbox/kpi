{expect} = require('../helper/fauxChai')

$ = require "jquery"
$survey = require("../../jsapp/xlform/src/model.survey")
# $choices = require("../../jsapp/xlform/src/model.choices")
_ = require "underscore"
$surveyFixtures = require("../fixtures/xlformSurveys")
window._ = _

module.exports = do ->
  describe 'rank question type', ->
    beforeEach ->
      @survey = $survey.Survey.load({
          survey: [
            {
              type: 'rank',
              rank_from: 'colors'
              name: 'colors',
              label: 'Favorite color'
            }
          ],
          choices: [
            {
              list_name: 'colors',
              name: 'red',
              label: 'Red'
            },
            {
              list_name: 'colors',
              name: 'yellow',
              label: 'Yellow'
            },
            {
              list_name: 'colors',
              name: 'blue',
              label: 'Blue'
            },
          ]
        })
      @choices = @survey.choices
      @colorchoices = @choices.get('colors')

    # it 'has options in list', ->
    #   expect(@colors.options.length).toBe(3)
    # it 'can add option to a choice list', ->
    #   @colors.options.add(name: 'green', label: 'Green')
    #   expect(@colors.options.length).toBe(4)
    # it 'can remove a option', ->
    #   opt = @colors.options.find (o)-> o.get('name') is 'red'
    #   expect(opt).toBeDefined()
    #   expect(@colors.options.length).toBe(3)
    #   @colors.options.remove(opt)
    #   expect(@colors.options.length).toBe(2)

    it 'exports rank choice list like a select question choice list', ->
      expect(@choices.toJSON()).toEqual([
          {
              name: "colors",
              options: [
                  {
                      name: "red",
                      label: "Red"
                  },
                  {
                      name: "yellow",
                      label: "Yellow"
                  },
                  {
                      name: "blue",
                      label: "Blue"
                  }
              ]
          }
      ])

    it 'exports a rank question properly', ->
      surveyJSON = @survey.toJSON()
      expect(surveyJSON).toEqual({
        survey: [
          {
            type: 'rank',
            rank_from: 'colors'
            name: 'colors',
            label: 'Favorite color'
          }
        ],
        choices: [
          {
            list_name: 'colors',
            name: 'red',
            label: 'Red'
          },
          {
            list_name: 'colors',
            name: 'yellow',
            label: 'Yellow'
          },
          {
            list_name: 'colors',
            name: 'blue',
            label: 'Blue'
          },
        ]
      })
    it 'reimports an exported survey with a rank question', ->
      surveyJSON = @survey.toJSON()
      reimported = $survey.Survey.load(surveyJSON)
      expect(reimported.toJSON()).toEqual(surveyJSON)

