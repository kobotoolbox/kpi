{expect} = require('../helper/fauxChai')
_ = require('underscore')

$model = require("../../jsapp/xlform/src/_model")

xlform_survey_model = ($model)->
  beforeEach ->
    @pizzaSurvey = $model.Survey.load(PIZZA_SURVEY)
    @createSurveyCsv = (survey=[],choices=[])->
      choiceSheet = if choices.length is 0 then "" else """
      choices,,,
      ,list name,name,label
      ,#{choices.join("\n,")}
      """
      """
      survey,,,
      ,type,name,label,hint
      ,#{survey.join("\n,")}
      #{choiceSheet}
      """
    @createSurvey = (survey=[],choices=[])=>
      $model.Survey.load @createSurveyCsv survey, choices
    @firstRow = (s)-> s.rows.at(0)
    @compareCsvs = (x1, x2)->
      x1r = x1.split("\n")
      x2r = x2.split("\n")
      for r in _.min([x1r.length, x2r.length])
        expect(x1r[r]).toBe(x2r[r])
      expect(x1).toBe(x2)
    @dumpAndLoad = (scsv)=>
      s1 = $model.Survey.load scsv
      x1 = s1.toCSV()
      s2 = $model.Survey.load x1
      x2 = s2.toCSV()
      @compareCsvs(x1, x2)

  it "creates xlform", ->
    xlf = new $model.Survey name: "Sample"
    expect(xlf).toBeDefined()
    expect(xlf instanceof $model.Survey).toBe(true)
    expect(xlf.get("name")).toBe("Sample")

  it "ensures every node has access to the parent survey", ->
    @pizzaSurvey.getSurvey

  it "can append a survey to another", ->
    dead_simple = @createSurvey(['text,q1,Question1,q1hint', 'text,q2,Question2,q2hint'])
    expect(dead_simple.rows.length).toBe(2)
    expect(@pizzaSurvey.rows.length).toBe(1)
    dead_simple.insertSurvey(@pizzaSurvey)

    expect(dead_simple.rows.length).toBe(3)
    expect(dead_simple.rows.at(2).getValue("name")).toBe("likes_pizza")

  it "can import from csv_repr", ->
    expect(@pizzaSurvey.rows.length).toBe(1)
    firstRow = @pizzaSurvey.rows.at(0)
    expect(firstRow.getValue("name")).toEqual("likes_pizza")

  describe "with simple survey", ->
    beforeEach ->
      @firstRow = @pizzaSurvey.rows.at(0)
    describe "lists", ->
      it "iterates over every row", ->
        expect(@pizzaSurvey.rows).toBeDefined()
        expect(@firstRow).toBeDefined()
      it "can add a list as an object", ->
        expect(@pizzaSurvey.choices.length).toBe(1)
        @pizzaSurvey.choices.add LISTS.gender
        expect(@pizzaSurvey.choices.length).toBe(2)
        x1 = @pizzaSurvey.toCsvJson()

        # it should prevent duplicate lists with the same id
        @pizzaSurvey.choices.add LISTS.yes_no
        expect(@pizzaSurvey.choices.length).toBe(2)
        x2 = @pizzaSurvey.toCsvJson()
        expect(x1).toEqual(x2)
      it "can add row to a specific index", ->
        expect(@pizzaSurvey.addRowAtIndex).toBeDefined()
        # last question
        rowc = @pizzaSurvey.rows.length
        expect(@pizzaSurvey.rows.length).toBe 1
        @pizzaSurvey.addRowAtIndex({
          name: "lastrow",
          label: "last row",
          type: "text"
          }, rowc)
        expect(@pizzaSurvey.rows.length).toBe 2
        expect(@pizzaSurvey.rows.last().get("label").get("value")).toBe("last row")

        @pizzaSurvey.addRowAtIndex({
          name: "firstrow",
          label: "first row",
          type: "note"
          }, 0)

        expect(@pizzaSurvey.rows.length).toBe 3
        expect(@pizzaSurvey.rows.first().get("label").get("value")).toBe("first row")

        @pizzaSurvey.addRowAtIndex({
          name: "secondrow",
          label: "second row",
          type: "note"
          }, 1)

        expect(@pizzaSurvey.rows.length).toBe 4
        expect(@pizzaSurvey.rows.at(1).get("label").get("value")).toBe("second row")

        labels = _.map @pizzaSurvey.rows.pluck("label"), (i)-> i.get("value")
        expect(labels).toEqual([ 'first row', 'second row', 'Do you like pizza?', 'last row' ])

    it "row types changing is trackable", ->
      expect(@firstRow.getValue("type")).toBe("select_one yes_no")
      typeDetail = @firstRow.get("type")
      expect(typeDetail.get("typeId")).toBe("select_one")
      expect(typeDetail.get("list").get("name")).toBe "yes_no"

      list = @firstRow.getList()
      expect(list).toBeDefined()
      expect(list.get("name")).toBe("yes_no")

  describe "with custom surveys", ->
    beforeEach ->
      @createSurveyCsv = (survey=[],choices=[])->
        choiceSheet = if choices.length is 0 then "" else """
        choices,,,
        ,list name,name,label
        ,#{choices.join("\n,")}
        """
        """
        survey,,,
        ,type,name,label,hint
        ,#{survey.join("\n,")}
        #{choiceSheet}
        """
      @createSurvey = (survey=[],choices=[])=>
        $model.Survey.load @createSurveyCsv survey, choices
      @firstRow = (s)-> s.rows.at(0)
      @compareCsvs = (x1, x2)->
        x1r = x1.split("\n")
        x2r = x2.split("\n")
        for r in _.min([x1r.length, x2r.length])
          expect(x1r[r]).toBe(x2r[r])
        expect(x1).toBe(x2)

      @dumpAndLoad = (scsv)=>
        s1 = $model.Survey.load scsv
        x1 = s1.toCSV()
        s2 = $model.Survey.load x1
        x2 = s2.toCSV()
        @compareCsvs(x1, x2)

    it "breaks with an unk qtype", ->
      # makeInvalidTypeSurvey = =>
      #   @createSurvey ["telegram,a,a,a"]
      # expect(makeInvalidTypeSurvey).toThrow()

    it "exports and imports without breaking", ->
      # this is _the one_ that breaks :|
      # scsv = @createSurveyCsv ["text,text,text,text"]
      # @dumpAndLoad scsv

    it "reflects correct required value", ->
      processed_required = (val)->
        $model.Survey.loadDict({
          survey: [
              {type: 'text',
              name: 'nm',
              required: val}
            ]
          }).toFlatJSON().survey[0].required

      # being very thorough in the things that can reflect required
      # true/false values
      expect(processed_required('true')).toEqual('true')
      expect(processed_required('TRUE')).toEqual('true')
      expect(processed_required('yes')).toEqual('true')
      expect(processed_required('YES')).toEqual('true')
      expect(processed_required(true)).toEqual('true')

      expect(processed_required('false')).toEqual('false')
      expect(processed_required('FALSE')).toEqual('false')
      expect(processed_required('NO')).toEqual('false')
      expect(processed_required('no')).toEqual('false')
      expect(processed_required(false)).toEqual('false')

      expect(processed_required(`undefined`)).toEqual('false')
      expect(processed_required('')).toEqual('false')

  describe 'test start questions', ->
    beforeEach ->
      @srv = $model.Survey.loadDict({
        survey: [
          {
            type: 'start',
            name: 'start',
          },
        ]
      })
    it "loads start meta question", ->
      start_sd = @srv.surveyDetails.get('start')
      expect(start_sd.get('name')).toEqual('start')
      expect(start_sd.get('value')).toEqual(true)

  describe 'test background-audio questions', ->
    beforeEach ->
      @srv = $model.Survey.loadDict({
        survey: [
          {
            type: 'background-audio',
            name: 'background-audio',
          },
        ]
      })

    it "loads background-audio with parameters", ->
      srv = $model.Survey.loadDict({
        survey: [
          {
            type: 'background-audio',
            name: 'background-audio',
            parameters: 'quality=99'
          },
        ]
      })
      exported = srv.toJSON()
      expect(exported.survey[0].parameters).toEqual('quality=99')

    it "loads bg audio meta question", ->
      sd1 = @srv.surveyDetails.get('background-audio')
      expect(sd1.get('name')).toEqual('background-audio')
      expect(sd1.get('value')).toEqual(true)

    it "when value is false (un-checked in the interace), no row is added", ->
      @srv.surveyDetails.get('background-audio').set('value', false)
      exported = @srv.toJSON()
      expect(exported.survey.length).toEqual(0)

    it "exports to json properly", ->
      exported = @srv.toJSON()
      expect(exported.survey[0].type).toEqual('background-audio')
      expect(exported.survey[0].name).toEqual('background-audio')

    it "captures required values", ->
      srv = $model.Survey.loadDict({
          survey: [
            {
              type: 'text',
              name: 'q1',
              required: true
            },
            {
              type: 'text',
              name: 'q2',
              required: false
            }
          ]
        })
      exported = srv.toJSON()
      expect(exported.survey[0]['required']).toEqual('true')
      expect(exported.survey[1]['required']).toEqual('false')

    it "tries a few question types", ->
      srv = @createSurvey ["text,text,text,text"]
      row1 = srv.rows.at(0)

      r1type = row1.get("type")
      expect(r1type.get("rowType").name).toBe("text")

      # # a survey with 2 lists: "x" and "y"
      srv = @createSurvey [""""select_multiple x",a,a,a"""],
                          ["x,ax,ax","x,bx,bx,","y,ay,ay","y,by,by"]

      row1 = srv.rows.at(0)
      r1type = row1.get("type")
      expect(r1type.get("typeId")).toBe("select_multiple")
      expect(r1type.get("list").get("name")).toBe("x")
      expect(row1.getList().get("name")).toBe("x")
      # change row to to "select_multiple y".

      r1type.set("value", "select_multiple y")
      expect(r1type.get("typeId")).toBe("select_multiple")
      expect(r1type.get("list").get("name")).toBe("y")
      expect(row1.toJSON().type).toBe("select_multiple y")
      expect(row1.getList().get("name")).toBe("y")

      # change row to "text"
      row1.get("type").set("value", "text")
      expect(row1.get("type").get("value")).toBe("text")

      # Right now, thinking that we should keep the list around
      # and test to make sure the exported value doesn't have a list
      expect(row1.get("type").get("list").get("name")).toBeDefined()
      expect(row1.getList().get("name")).toBeDefined()
      expect(row1.toJSON().type).toBe("text")

      # # adding an invalid list will break things.
      #
      # I'm thinking: adding an invalid list will only break validation of
      # the survey. If it's not defined, it will prompt the user to make
      # the row valid.
      #
      # setToInvalidList = ()->
      #   row1.get("type").set("value", "select_one badlist")
      # expect(setToInvalidList).toThrow()
      ``
  describe "groups", ->
    it "cannot add a group by adding a row type=group", ->
      @pizzaSurvey.addRow type: "text", name: "pizza", hint: "pizza", label: "pizza"
      expect(@pizzaSurvey.rows.last() instanceof $model.Row).toBe(true)
      expect(@pizzaSurvey.rows.length).toBe(2)
      @pizzaSurvey.addRow type: "group", name: "group"
      expect(@pizzaSurvey.rows.length).toBe(3)
      grp = @pizzaSurvey.rows.last()
      expect(grp instanceof $model.BaseRow).toBe(true)

    it "exports group to json", ->
      @pizzaSurvey.addRow type: "text", name: "pizza", hint: "pizza", label: "pizza"
      expect(@pizzaSurvey.rows.last() instanceof $model.Row).toBe(true)
      expect(@pizzaSurvey.rows.length).toBe(2)
      @pizzaSurvey.addRow type: "group", name: "group"
      expect(@pizzaSurvey.rows.length).toBe(3)
      grp = @pizzaSurvey.rows.last()
      _as_json = @pizzaSurvey.toFlatJSON()
      survey_kuids = _as_json.survey.map((r)=>r['$kuid'])
      for kuid in survey_kuids
        expect(kuid).toBeDefined()

  describe "automatic naming", ->
    it "can import questions without names", ->
      survey = @createSurvey([
        "text,,\"Label with no name\""
        ])
      expect(survey.rows.at(0)?.get("name").getValue()).not.toBeTruthy()
    it "can finalize survey and generate names", ->
      survey = @createSurvey([
        "text,,\"Label with no name\""
        ])
      expect(survey.rows.at(0)?.get("name").getValue()).not.toBeTruthy()
      survey.rows.at(0).finalize()
      expect(survey.rows.at(0)?.get("name").getValue()).toBe("Label_with_no_name")
    it "increments names that are already taken", ->
      survey = @createSurvey([
        "text,question_one,\"already named question_one\"",
        "text,,\"question one\""
        ])
      # as imported
      expect(survey.rows.at(0)?.get("name").getValue()).toBe("question_one")
      # incremented from other question
      expect(survey.finalize().rows.at(1)?.get("name").getValue()).toBe("question_one_001")

  describe "lists", ->
    it "can change a list for a question", ->
      # add a new list. "yes, no, maybe"
      @pizzaSurvey.choices.add(name: "yes_no_maybe")
      ynm = @pizzaSurvey.choices.get("yes_no_maybe")
      expect(ynm).toBeDefined()

      # test original state
      firstRow = @pizzaSurvey.rows.first()
      expect(firstRow.getList().get("name")).toBe("yes_no")

      # change the list for first question to be "yes_no_maybe" instead of "yes_no"
      expect(firstRow.getList().get("name")).toBe("yes_no")
      firstRow.setList(ynm)
      expect(firstRow.getList().get("name")).toBe("yes_no_maybe")

      # change it back
      firstRow.setList("yes_no")
      expect(firstRow.getList().get("name")).toBe("yes_no")

      # cannot change it to a nonexistant list
      expect(-> firstRow.setList("nonexistant_list")).toThrow()

      # changing name of list object will not unlink the list
      list = firstRow.getList()
      list.set("name", "no_yes")
      expect(firstRow.getList()).toBeDefined()
      expect(firstRow.getList()?.get("name")).toBe("no_yes")

    it "can change options for a list", ->
      yn = @pizzaSurvey.choices.get("yes_no")
      expect(yn.options).toBeDefined()

      @pizzaSurvey.choices.add(name: "yes_no_maybe")
      ynm = @pizzaSurvey.choices.get("yes_no_maybe")
      expect(ynm).toBeDefined()

      expect(ynm.options.length).toBe(0)
      ynm.options.add name: "maybe", label: "Maybe"
      ynm.options.add [{name: "yes", label: "Yes"}, {name: "no", label: "No"}]
      expect(ynm.options.length).toBe(3)

  describe "census xlform", ->
    beforeEach ->
      @census = $model.Survey.load(CENSUS_SURVEY)
    it "looks good", ->
      expect(@census).toBeDefined()

# simple fixtures for tests above
PIZZA_SURVEY = """
  survey,,,
  ,type,name,label
  ,select_one yes_no,likes_pizza,Do you like pizza?
  choices,,,
  ,list name,name,label
  ,yes_no,yes,Yes
  ,yes_no,no,No
  """

CENSUS_SURVEY = """
  "survey","type","name","label"
  ,"integer","q1","How many people were living or staying in this house, apartment, or mobile home on April 1, 2010?"
  ,"select_one yes_no","q2","Were there any additional people staying here April 1, 2010 that you did not include in Question 1?"
  ,"select_one ownership_type or_other","q3","Is this house, apartment, or mobile home: owned with mortgage, owned without mortgage, rented, occupied without rent?"
  ,"text","q4","What is your telephone number?"
  ,"text","q5","Please provide information for each person living here. Start with a person here who owns or rents this house, apartment, or mobile home. If the owner or renter lives somewhere else, start with any adult living here. This will be Person 1. What is Person 1's name?"
  ,"select_one male_female","q6","What is Person 1's sex?"
  ,"date","q7","What is Person 1's age and Date of Birth?"
  ,"text","q8","Is Person 1 of Hispanic, Latino or Spanish origin?"
  ,"text","q9","What is Person 1's race?"
  ,"select_one yes_no","q10","Does Person 1 sometimes live or stay somewhere else?"
  "choices","list name","name","label"
  ,"yes_no","yes","Yes"
  ,"yes_no","no","No"
  ,"male_female","male","Male"
  ,"male_female","female","Female"
  ,"ownership_type","owned_with_mortgage","owned with mortgage",
  ,"ownership_type","owned_without_mortgage","owned without mortgage"
  ,"ownership_type","rented","rented"
  ,"ownership_type","occupied_without_rent","occupied without rent"
  "settings"
  ,"form_title","form_id"
  ,"Census Questions (2010)","census2010"
  """

LISTS =
  yes_no:
    name: "yes_no"
    options: [
      {"list name": "yes_no", name: "yes", label: "Yes"},
      {"list name": "yes_no", name: "no", label: "No"}
    ]
  gender:
    name: "gender"
    options: [
      {"list name": "gender", name: "f", label: "Female"},
      {"list name": "gender", name: "m", label: "Male"}
    ]

describe "xlform survey model", -> xlform_survey_model.call(@, $model)
