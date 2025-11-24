{expect} = require('../helper/fauxChai')

$validationParser = require("../../jsapp/xlform/src/model.validationLogicParser")
$choices = require("../../jsapp/xlform/src/model.choices")
$surveys = require("../fixtures/xlformSurveys")

do ->
  describe '" $validationLogicParser', ->
    describe 'equalityCriterionPattern', ->
      it 'matches resp_equals operators', ->
        results = $validationParser('. = 123')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '123'}]
          })

      it 'matches resp_notequals operators', ->
        results = $validationParser('. != 123')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_notequals', response_value: '123'}]
          })

      it 'matches resp_greater operators', ->
        results = $validationParser('. > 123')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_greater', response_value: '123'}]
          })

      it 'matches resp_less operators', ->
        results = $validationParser('. < 123')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_less', response_value: '123'}]
          })

      it 'matches resp_greaterequals operators', ->
        results = $validationParser('. >= 123')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_greaterequals', response_value: '123'}]
          })

      it 'matches resp_lessequals operators', ->
        results = $validationParser('. <= 123')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_lessequals', response_value: '123'}]
          })

      it 'matches date response values ', ->
        results = $validationParser(". = 'date(1991-09-02)'")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: 'date(1991-09-02)'}]
          })

      # Same test as the first, but duplicated anyway because it's for a different purpose
      it 'matches integer response values ', ->
        results = $validationParser(". = 123")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '123'}]
          })

      it 'matches decimal response values ', ->
        results = $validationParser(". = 123.456")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '123.456'}]
          })

      it 'matches decimal (nothing in front of the radix point) with response values', ->
        results = $validationParser(". = .654")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '.654'}]
          })

      it 'matches string response values ', ->
        results = $validationParser(". = 'pineapple is great on pizza'")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: 'pineapple is great on pizza'}]
          })

      it 'does not include closing parentheses in date response values', ->
        results = $validationParser("(. = 'date(1991-09-02)')")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: 'date(1991-09-02)'}]
          })

      it 'does not include closing parentheses in integer response values', ->
        results = $validationParser("(. = 123)")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '123'}]
          })

      it 'does not include closing parentheses in decimal response values', ->
        results = $validationParser("(. = 123.456)")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '123.456'}]
          })

      it 'does not include closing parentheses in decimal (nothing in front of the radix point) response values', ->
        results = $validationParser("(. = .456)")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '.456'}]
          })

      it 'does not include closing parentheses in string response values', ->
        results = $validationParser("(. = 'coriander is delicious')")
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: 'coriander is delicious'}]
          })
        
      it 'gracefully handles spurious whitespace', ->
        results = $validationParser('(  .  =     123   )')
        expect(results).toEqual(
          {
            criteria: [{name:'.', operator:'resp_equals', response_value: '123'}]
          })
