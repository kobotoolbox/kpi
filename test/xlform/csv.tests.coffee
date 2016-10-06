{expect} = require('../helper/fauxChai')

csv = require("../../jsapp/xlform/src/csv")

do ->
  example2 = "\"regex_sheet\"\r\n\"\",\"col1\",\"regexcol\"\r\n\"\",\"row1\",\"regex( \\s+ )\"\r\n\"regex_sheet2\"\r\n\"\",\"s2col1\",\"example2\"\r\n\"\",\"s2row1\",\"\\s\\d\\w\\S\\D\\W\"\r\n"

  silly_cell = """
    regex(., '^\\S+( \\S+){4}$' )
  """
  example = """
    "type","constraint"
    "text","#{silly_cell}"
    """

  describe "csv parsing", ->
    beforeEach ->
      window._csv = csv
      @compile = (content)->
        csv(content).toObjects()[0]
    it "equals", ->
      parse_content_body = ->
        csv(example2)
      expect(parse_content_body).not.toThrow()
    it "handles simple csvs", ->
      ex1 = @compile("""
        a,b,c,d
        e,f,g,h
        """)
      expect(ex1.a).toBe('e')
      expect(ex1.b).toBe('f')
      expect(ex1.c).toBe('g')
      expect(ex1.d).toBe('h')

    it "handles csvs with quotes", ->
      ex1 = @compile("""
        "a","b","c","d"
        "e","f","g","h"
        """)
      expect(ex1.a).toBe('e')
      expect(ex1.b).toBe('f')
      expect(ex1.c).toBe('g')
      expect(ex1.d).toBe('h')

    it "imports cells with escape characters", ->
      ex1 = @compile(example)
      expect(ex1.type).toBe('text')
      expect(ex1.constraint).toBe(silly_cell)

    it "reexports cells with escape characters", ->
      converted_to_objects = csv(example).toObjects()
      converted_to_string = csv(converted_to_objects).toString()
      expect(converted_to_string).toEqual(example)

$inputDeserializer = require("../../jsapp/xlform/src/model.inputDeserializer")

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
