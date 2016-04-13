{expect} = require('../helper/fauxChai')

$ = require "jquery"
$survey = require("../../jsapp/xlform/src/model.survey")
$choices = require("../../jsapp/xlform/src/model.choices")

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

    describe 'Choicelist', ->
      describe 'Clone method', ->
        it 'Clones itself and all of its options', ->
          yesnoClone = @yesno.clone()
          expect(yesnoClone.options.length).toBe 2
          expect(yesnoClone.options.at(0).get('name')).toBe 'yes'
          expect(yesnoClone.options.at(1).get('name')).toBe 'no'
          expect(yesnoClone.cid).not.toEqual @yesno.cid
          expect(yesnoClone.get('name')).not.toBe @yesno.get('name')
