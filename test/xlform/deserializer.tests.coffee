{expect} = require('../helper/fauxChai')

$inputDeserializer = require("../../jsapp/xlform/src/model.inputDeserializer")
$surveys = require("../fixtures/xlformSurveys")

do ->
  deserialize = $inputDeserializer.deserialize
  describe '$inputDeserializer', ->
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

    describe '. deserialize parses csv, json, and object', ->
      it 'has deserialize method defined', ->
        expect(deserialize).toBeDefined()
      ###
      # csv appears be broken right now
      it 'parses a csv', ->
        oneliner = "survey,,,\n,key1,key2,key3\n,val1,val2,val3\nchoices,,,\n,k4,k5\n,v4,v5"
        $inputDeserializer(oneliner)
        expect(deserialize(oneliner)).toEqual(@sampleSurveyObj)
      ###
      # it 'parses a json string', ->
      #   oneline_json = """{"survey":[{"key1":"val1","key2":"val2","key3":"val3"}],"choices":[{"k4":"v4","k5":"v5"}]}"""
      #   expect(deserialize(oneline_json)).toEqual(@sampleSurveyObj)
      it 'parses a js object', ->
        expect(deserialize(@sampleSurveyObj)).toEqual(@sampleSurveyObj)

    describe '.validateParse notifies validity', ->
      beforeEach ->
        @validate = (obj, tf=true, expectedError=false)->
          ctx = {}
          isValid = $inputDeserializer.validateParse(obj, ctx)
          expect(ctx).toBeDefined()
          expect(isValid).toBe(tf)
          expect(ctx.error).toEqual(expectedError)  if expectedError

      it 'with just survey sheet', ->
        @validate survey: []
      describe 'but does not accept non-object parameters', ->
        it '[string]', ->
          @validate 'cant be a string', false
        it '[array]', ->
          @validate ['cant be an array'], false
    describe 'deserializes and records errors', ->
      it 'when input is missing survey sheet', ->
        ss2 =
          notSurvey: @sampleSurveyObj.survey
          choices: @sampleSurveyObj.choices
        context = {validate: true}
        $inputDeserializer(ss2, context)
        expect(context.error).toBeDefined()
        expect(context.error).toContain('survey sheet')


###
require [$survey = require 'cs!xlform/model.survey'
require("../../jsapp/xlform/src/model.survey', 'cs!fixtures/surveys'], ($survey, $surveyFixtures)->
  Survey = $survey.Survey
  pizza_survey = $surveyFixtures.pizza_survey

  ensure_equivalent = (sFixId)->
    fixt = $surveyFixtures[sFixId]
    describe "fixtures/surveys.#{sFixId}:", ->
      it "the fixture exists", ->
        expect(fixt.csv).toBeDefined()
        expect(fixt.xlf).toBeDefined()
        expect(fixt.xlf2).toBeDefined()

      describe "the fixture imports from object", ->
        beforeEach ->
          @s1 = Survey.load(fixt.csv)
          @s2 = Survey.load(fixt.xlf)
          @s3 = Survey.load(fixt.xlf2)

        it "creates surveys", ->
          expect(@s1).toBeDefined()
          expect(@s2).toBeDefined()
          expect(@s3).toBeDefined()

        it "creates surveys with matching fingerprints", ->
          fingerprint = (s)->
            # something that ensures the output is equivalent
            "#{s.toCSV().length}"
          expect(fingerprint(@s1)).not.toBe('')
          expect(fingerprint(@s1)).toEqual(fingerprint(@s2))
          expect(fingerprint(@s1)).toEqual(fingerprint(@s3))
          expect(fingerprint(@s2)).toEqual(fingerprint(@s3))

  ensure_equivalent('pizza_survey')
###
