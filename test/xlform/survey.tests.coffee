{expect} = require('../helper/fauxChai')

$model = require("../../jsapp/xlform/src/_model")

do ->
  surveys = {}
  surveys.group = """
      survey,,,
      ,type,name,label
      ,text,q1,Question1
      ,begin group,grp,
      ,text,g1q1,Group1Question1
      ,text,g1q2,Group1Question2
      ,end group,,
      """
  surveys.iterateOver = """
      survey,,,
      ,type,name,label
      ,text,q1,Question1
      ,begin group,grp,
      ,text,g1q1,Group1Question1
      ,text,g1q2,Group1Question2
      ,end group,,
      ,text,q8,Question8
      ,text,q9,Question9
      ,err,err,err
      """
  surveys.singleQ = """
      survey,,,
      ,type,name,label
      ,text,q1,Question1
      """
  surveys.withChoices = """
      survey,,,
      ,type,name,label
      ,select_one yesno,yn,YesNo
      choices,,,
      ,list name,label,name
      ,yesno,Yes,yes
      ,yesno,No,no
      """
  describe 'survey.tests: Row content', ->
    it 'properly sluggifies row labels', ->
      survey = new $model.Survey()
      survey.rows.add(type: 'text', label: 'how many people?')
      expect(survey.rows.length).toBe(1)
      lastRow = survey.rows.at(0)
      expect(lastRow.get('name').get('value')).toBe('')
      expect(lastRow.get('label').get('value')).toBe('how many people?')
      lastRow.finalize()
      expect(lastRow.get('name').get('value')).toBe('how_many_people')

  describe 'survey.tests: Row types', ->
    beforeEach ->
      window.xlfHideWarnings = true
      @survey = new $model.Survey()
    afterEach -> window.xlfHideWarnings = false

    describe 'populates default values properly', ->
      beforeEach ->
        @populateRow = (opts={})=>
          @survey.rows.add(opts)
          @row = @survey.rows.at(0)
        @expectValue = (key)->
          expect(@row.get(key).get('value'))
      it 'text is required', ->
        @populateRow(type: 'text')
        @expectValue('required').toBe(false)
      it 'select one is required', ->
        @populateRow(type: 'select_one')
        @expectValue('required').toBe(false)
      it 'integer is required', ->
        @populateRow(type: 'integer')
        @expectValue('required').toBe(false)
      it 'geopoint is not required', ->
        @populateRow(type: 'geopoint')
        @expectValue('required').toBe(false)
      it 'geotrace is not required', ->
        @populateRow(type: 'geotrace')
        @expectValue('required').toBe(false)
      it 'geoshape is not required', ->
        @populateRow(type: 'geoshape')
        @expectValue('required').toBe(false)
      it 'note is not required', ->
        @populateRow(type: 'note')
        @expectValue('required').toBe(false)

    it 'has a valid empty survey', ->
      expect(@survey.toCSV()).toBeDefined()
    it 'can add rows to the survey', ->
      @survey.rows.add type: 'text', name: 'q1'
      expect(@survey.rows.at(0).toJSON().name).toBe('q1')
      @survey.rows.add type: '_errortype', name: 'q2'
      expect(@survey.rows.at(1).toJSON().type).toBe('_errortype')
      @survey.rows.add type: 'note', name: 'q3'
      expect(@survey.rows.at(2).toJSON().type).toBe('note')

  describe 'Survey load', ->
    beforeEach ->
      @_load_csv = (scsv)=>
        @survey = $model.Survey.load(scsv)
      @_load_md = (md)=>
        @survey = $model.Survey.load.md(md)
      @expectKeys = (obj, keys)->
        expect (obj[key]  for key in keys)

    it 'loads a single question survey', ->
      @_load_csv(surveys.singleQ)
      @expectKeys(@survey.toCsvJson().survey.rowObjects[0],
          ['type', 'name', 'label']).toEqual(['text', 'q1', 'Question1'])

    it 'loads a multiple choice survey', ->
      @_load_csv(surveys.withChoices)
      _results = @survey.toJSON()
      for row in _results.survey
        expect(row['$kuid']).toBeDefined()
        delete row['$kuid']
      expect(_results).toEqual({
          'survey': [
            {
              'type': 'select_one',
              'select_from_list_name': 'yesno',
              'name': 'yn',
              'label': 'YesNo',
              'required': 'false'
            }
          ],
          'choices': {
            'yesno': [
              {
                'label': 'Yes',
                'name': 'yes'
              },
              {
                'label': 'No',
                'name': 'no'
              }
            ]
          }
        })
    describe 'survey row reordering', ->
      beforeEach ->
        @surveyNames = ->
          names = []
          getName = (r)-> names.push r.get('name').get('value')
          @survey.forEachRow(getName, includeGroups: true)
          names
      it 'can switch ABC -> ACB', ->
        @_load_csv """
        survey,,,
        ,type,name,label
        ,text,qa,QuestionA
        ,text,qb,QuestionB
        ,text,qc,QuestionC
        """
        expect(@surveyNames()).toEqual(['qa', 'qb', 'qc'])
        [qa, qb, qc] = @survey.rows.models
        _parent = qa._parent
        @survey._insertRowInPlace(qc, previous: qa)
        expect(qc._parent).toBe(_parent)
        expect(@surveyNames()).toEqual(['qa', 'qc', 'qb'])

    describe 'forEachRow iterator tests', ->
      beforeEach ->
        window.xlfHideWarnings = true

        @_load_csv surveys.iterateOver
        @getProp = (propName, arr)->
          (r)->
            arr.push r.get(propName)?.get('value')
      afterEach -> window.xlfHideWarnings = false

      it 'runs normally', ->
        # without any options, it will skip the group but iterate
        # through the rows of the group
        @survey.forEachRow @getProp('name', names = [])
        expect(names).toEqual('q1 g1q1 g1q2 q8 q9'.split(' '))

      it 'runs flat', ->
        # when flat:true option is passed, it will not iterate through
        # any nested groups
        options =
          flat: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).toEqual('q1 q8 q9'.split(' '))

      it 'runs with includeGroups', ->
        # when includeGroups:true , it will include the group and the nested
        # values
        options =
          includeGroups: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).toEqual('q1 grp g1q1 g1q2 q8 q9'.split(' '))

      it 'runs with includeGroups', ->
        # when includeGroups:true , it will include the group and the nested
        # values
        options =
          includeGroups: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).toEqual('q1 grp g1q1 g1q2 q8 q9'.split(' '))

      it 'runs with includeErrors', ->
        # when includeErrors:true, it will include erroneous rows
        options =
          includeErrors: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).toEqual('q1 g1q1 g1q2 q8 q9 err'.split(' '))


  describe 'survey.tests: form_id auto-naming', () ->
    describe 'initialization', () ->
      it 'enables auto-naming when form is new', () ->
        survey = new $model.Survey()
        expect(survey.settings.auto_name).toBe true
    describe 'change:form_id', () ->
      it 'disables auto naming when changed manually', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_id', 'test'

        expect(settings.auto_name).toBe false
      it 'ignores when changed as part of a title change', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_title', 'test'

        expect(settings.auto_name).toBe true
    describe 'change:form_title', () ->
      it 'sets the form id when form in auto naming mode', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_title', 'test'

        expect(settings.get('form_id')).toBe 'test'
      it 'sluggifies label before setting id', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_title', 'test me'

        expect(settings.get('form_id')).toBe 'test_me'

  describe 'survey.tests: prep_cols', () ->
    it 'flattens and deduplicates arrays of strings', () ->
      survey = new $model.Survey()
      expect(survey.prepCols [['a', 'b'], ['b', 'c'], ['e', 'a', 'd']]).toEqual ['a', 'b', 'c', 'e', 'd']

    it 'excludes passed array of strings from result', () ->
      survey = new $model.Survey()
      expect(survey.prepCols [['a', 'b'], ['b', 'c'], ['e', 'a', 'de']], exclude: ['de']).toEqual ['a', 'b', 'c', 'e']

    it 'add passed string to result', () ->
      survey = new $model.Survey()
      expect(survey.prepCols [['a', 'b'], ['b', 'c'], ['e', 'a', 'de']], exclude: ['de'], add: ['abc']).toEqual ['a', 'b', 'c', 'e', 'abc']

  describe 'survey.tests: insertSurvey with library items (DEV-2269)', () ->
    beforeEach ->
      # Survey.loadDict() might trigger warnings during survey construction, and
      # we want clean test output
      window.xlfHideWarnings = true
      # Create a "library" survey with a select_one question
      @librarySurvey = $model.Survey.loadDict({
        survey: [
          {type: 'select_one fruits', name: 'fruit', label: 'Pick a fruit'}
        ],
        choices: [
          {list_name: 'fruits', name: 'tomato', label: 'Tomato'},
          {list_name: 'fruits', name: 'cucumber', label: 'Cucumber'},
          {list_name: 'fruits', name: 'corn', label: 'Corn'}
        ]
      })
      # Create a target survey to insert into
      @targetSurvey = new $model.Survey()

    afterEach -> window.xlfHideWarnings = false

    it 'preserves choice list options after insertSurvey and serialization', () ->
      # Insert the library question
      @targetSurvey.insertSurvey(@librarySurvey, 0)

      # Serialize to JSON and reload (simulates save/reload)
      surveyJSON = @targetSurvey.toFlatJSON()
      reloadedSurvey = $model.Survey.loadDict(JSON.parse(JSON.stringify(surveyJSON)))

      # Check that options are preserved
      reloadedRow = reloadedSurvey.rows.at(0)
      choiceList = reloadedRow.getList()
      expect(choiceList).toBeDefined()
      expect(choiceList.options.length).toBe(3)
      expect(choiceList.options.at(0).get('name')).toBe('tomato')
      expect(choiceList.options.at(1).get('name')).toBe('cucumber')
      expect(choiceList.options.at(2).get('name')).toBe('corn')

    it 'gives each inserted select question a unique choice list', () ->
      # Insert the library question twice
      @targetSurvey.insertSurvey(@librarySurvey, 0)
      @targetSurvey.insertSurvey(@librarySurvey, 1)

      # Get both rows
      firstRow = @targetSurvey.rows.at(0)
      secondRow = @targetSurvey.rows.at(1)

      # Check they have different list names
      firstListName = firstRow.get('type').get('listName')
      secondListName = secondRow.get('type').get('listName')
      expect(firstListName).toBeDefined()
      expect(secondListName).toBeDefined()
      expect(firstListName).not.toBe(secondListName)

      # Check they reference different list objects
      firstList = firstRow.getList()
      secondList = secondRow.getList()
      expect(firstList).not.toBe(secondList)

    it 'handles groups/blocks with nested select questions', () ->
      # Create a library block containing a select question
      # This simulates a more complex block from the library
      blockContent = {
        survey: [
          {type: 'begin_group', name: 'my_group', label: 'My Group'},
          {type: 'select_one colors', name: 'color', label: 'Pick a color'},
          {type: 'text', name: 'other_text', label: 'Some text'},
          {type: 'end_group'}
        ],
        choices: [
          {list_name: 'colors', name: 'red', label: 'Red'},
          {list_name: 'colors', name: 'blue', label: 'Blue'}
        ]
      }

      libraryBlock = $model.Survey.loadDict(blockContent)

      # Insert the block - it should have 1 group
      @targetSurvey.insertSurvey(libraryBlock, 0)
      expect(@targetSurvey.rows.length).toBe(1)

      group = @targetSurvey.rows.at(0)
      expect(group.constructor.key).toBe('group')

      # The group should have 2 nested rows (select + text)
      expect(group.rows.length).toBe(2)

      # The first row should be the select question
      selectRow = group.rows.at(0)
      expect(selectRow.get('type').get('typeId')).toBe('select_one')

      # It should have a choice list with options
      choiceList = selectRow.getList()
      expect(choiceList).toBeDefined()
      expect(choiceList.options.length).toBe(2)
      expect(choiceList.options.at(0).get('name')).toBe('red')
      expect(choiceList.options.at(1).get('name')).toBe('blue')

    it 'preserves options when library item uses separated type/select_from_list_name (API format)', () ->
      # The API stores select questions in separated format:
      #   {type: "select_one", select_from_list_name: "fruits"}
      # rather than the combined format {type: "select_one fruits"}.
      # This test ensures options are preserved through save/reload in that case.
      apiFormatSurvey = $model.Survey.loadDict({
        survey: [
          {type: 'select_one', select_from_list_name: 'fruits', name: 'fruit', label: 'Pick a fruit'}
        ],
        choices: [
          {list_name: 'fruits', name: 'tomato', label: 'Tomato'},
          {list_name: 'fruits', name: 'cucumber', label: 'Cucumber'},
          {list_name: 'fruits', name: 'corn', label: 'Corn'}
        ]
      })

      @targetSurvey.insertSurvey(apiFormatSurvey, 0)

      # Serialize to flat JSON (same as surveyToValidJson does) and reload
      surveyJSON = @targetSurvey.toFlatJSON()
      reloadedSurvey = $model.Survey.loadDict(JSON.parse(JSON.stringify(surveyJSON)))

      reloadedRow = reloadedSurvey.rows.at(0)
      choiceList = reloadedRow.getList()
      expect(choiceList).toBeDefined()
      expect(choiceList.options.length).toBe(3)
      expect(choiceList.options.at(0).get('name')).toBe('tomato')
      expect(choiceList.options.at(1).get('name')).toBe('cucumber')
      expect(choiceList.options.at(2).get('name')).toBe('corn')

  describe 'survey.tests: unique row names for library items (DEV-2269)', () ->
    # The names Formbuilder shows on the cards
    rowNames = (survey) ->
      names = []
      survey.forEachRow ((row) -> names.push(row.getValue('name'))), includeGroups: true
      return names

    # The names that end up in the XLSForm. `toCsvJson()` finalizes the survey
    # itself, so comparing the two catches the model drifting away from the export.
    # Group-end rows are dropped - they close a group instead of being a column.
    exportedNames = (survey) ->
      rows = survey.toCsvJson().survey.rowObjects
      return (row.name for row in rows when not /^end[ _]/.test(row.type))

    beforeEach ->
      window.xlfHideWarnings = true
      # Factories, not shared instances: each drag from the Library fetches the
      # asset again, so every insert gets its own freshly parsed Survey
      @libraryQuestion = -> $model.Survey.loadDict({
        survey: [
          {type: 'select_one fruits', name: 'choose_a_fruit', label: 'Choose a fruit'}
        ],
        choices: [
          {list_name: 'fruits', name: 'apple', label: 'Apple'},
          {list_name: 'fruits', name: 'pear', label: 'Pear'}
        ]
      })
      @libraryBlock = -> $model.Survey.loadDict({
        survey: [
          {type: 'begin_group', name: 'fruit_block', label: 'Fruit block'},
          {type: 'select_one fruits', name: 'choose_a_fruit', label: 'Choose a fruit'},
          {type: 'text', name: 'fruit_notes', label: 'Notes'},
          {type: 'end_group'}
        ],
        choices: [
          {list_name: 'fruits', name: 'apple', label: 'Apple'},
          {list_name: 'fruits', name: 'pear', label: 'Pear'}
        ]
      })
      @targetSurvey = new $model.Survey()

    afterEach -> window.xlfHideWarnings = false

    it 'gives each copy of a library question a unique name', () ->
      @targetSurvey.insertSurvey(@libraryQuestion(), 0)
      @targetSurvey.insertSurvey(@libraryQuestion(), 1)

      expect(rowNames(@targetSurvey)).toEqual ['choose_a_fruit', 'choose_a_fruit_001']

    it 'gives each copy of a library block a unique name, inside and out', () ->
      @targetSurvey.insertSurvey(@libraryBlock(), 0)
      @targetSurvey.insertSurvey(@libraryBlock(), 1)

      expect(rowNames(@targetSurvey)).toEqual [
        'fruit_block', 'choose_a_fruit', 'fruit_notes',
        'fruit_block_001', 'choose_a_fruit_001', 'fruit_notes_001'
      ]

    it 'renames against questions already in the form, not just other library copies', () ->
      survey = $model.Survey.loadDict({
        survey: [
          {type: 'text', name: 'choose_a_fruit', label: 'Typed by hand'}
        ]
      })
      survey.insertSurvey(@libraryQuestion(), 1)

      expect(rowNames(survey)).toEqual ['choose_a_fruit', 'choose_a_fruit_001']

    it 'names library questions that only carry a label', () ->
      # A library question saved without a name only has one in `$autoname`, which
      # is not where the "Data column name" field reads from
      unnamedQuestion = -> $model.Survey.loadDict({
        survey: [
          {type: 'text', $autoname: 'choose_a_fruit', label: 'Choose a fruit'}
        ]
      })
      @targetSurvey.insertSurvey(unnamedQuestion(), 0)
      @targetSurvey.insertSurvey(unnamedQuestion(), 1)

      expect(rowNames(@targetSurvey)).toEqual ['Choose_a_fruit', 'Choose_a_fruit_001']

    it 'shows the same names Formbuilder will write to the XLSForm', () ->
      @targetSurvey.insertSurvey(@libraryQuestion(), 0)
      @targetSurvey.insertSurvey(@libraryQuestion(), 1)
      @targetSurvey.insertSurvey(@libraryBlock(), 2)
      @targetSurvey.insertSurvey(@libraryBlock(), 3)

      # `start`/`end` are survey metadata rows that only the exporter adds
      expect(exportedNames(@targetSurvey)).toEqual rowNames(@targetSurvey).concat(['start', 'end'])

    it 'keeps names in sync through a save and reload', () ->
      @targetSurvey.insertSurvey(@libraryQuestion(), 0)
      @targetSurvey.insertSurvey(@libraryQuestion(), 1)

      surveyJSON = @targetSurvey.toFlatJSON()
      reloadedSurvey = $model.Survey.loadDict(JSON.parse(JSON.stringify(surveyJSON)))

      expect(rowNames(reloadedSurvey)).toEqual ['choose_a_fruit', 'choose_a_fruit_001']

    it 'leaves an already unique name untouched', () ->
      # `deduplicate()` truncates at 30 characters, so names that don't clash must
      # never go through it
      longName = 'a_very_long_question_name_that_exceeds_thirty_characters'
      @targetSurvey.insertSurvey($model.Survey.loadDict({
        survey: [{type: 'text', name: longName, label: 'Long one'}]
      }), 0)

      expect(rowNames(@targetSurvey)).toEqual [longName]

  describe 'survey.tests: selects without a choice list', () ->
    beforeEach -> window.xlfHideWarnings = true
    afterEach -> window.xlfHideWarnings = false

    it 'omits select_from_list_name instead of writing an empty one', () ->
      # A select that has no list yet used to serialize `select_from_list_name`
      # as undefined, which the constructor then read back as the literal type
      # "select_one undefined"
      survey = $model.Survey.loadDict({
        survey: [{type: 'select_one', name: 'a', label: 'A'}]
      })
      rowJSON = survey.rows.at(0).toJSON2()
      expect('select_from_list_name' of rowJSON).toBe(false)

      reloaded = new $model.Survey()
      reloaded.rows.add(rowJSON)
      expect(reloaded.rows.at(0).get('type').get('value')).toBe('select_one')

  describe 'survey.tests: select_one_external', () ->
    # We can't edit this type (its choices live in the `external_choices` sheet,
    # which Form Builder doesn't load), but loading it must not throw, and saving
    # must give the row back unchanged.
    beforeEach -> window.xlfHideWarnings = true
    afterEach -> window.xlfHideWarnings = false

    it 'loads without becoming an error row', () ->
      survey = $model.Survey.loadDict({
        survey: [
          {type: 'select_one_external', select_from_list_name: 'regions', name: 'region', label: 'Region'}
        ]
      })
      row = survey.rows.at(0)
      expect(row.isError()).toBe(false)
      expect(row.get('type').get('typeId')).toBe('select_one_external')

    it 'is marked as unsupported by UI', () ->
      survey = $model.Survey.loadDict({
        survey: [{type: 'select_one_external', name: 'region', label: 'Region'}]
      })
      expect(survey.rows.at(0).get('type').get('rowType').supportedByUI).toBe(false)

    it 'keeps the type and list name through a save/reload', () ->
      survey = $model.Survey.loadDict({
        survey: [
          {type: 'select_one_external', select_from_list_name: 'regions', name: 'region', label: 'Region'}
        ]
      })
      surveyJSON = survey.toFlatJSON()
      savedRow = surveyJSON.survey[0]
      expect(savedRow.type).toBe('select_one_external')
      expect(savedRow.select_from_list_name).toBe('regions')

      reloadedSurvey = $model.Survey.loadDict(JSON.parse(JSON.stringify(surveyJSON)))
      expect(reloadedSurvey.rows.at(0).isError()).toBe(false)

    it 'does not invent a list name when there was none', () ->
      survey = $model.Survey.loadDict({
        survey: [{type: 'select_one_external', name: 'region', label: 'Region'}]
      })
      savedRow = survey.toFlatJSON().survey[0]
      expect(savedRow.type).toBe('select_one_external')
      expect(savedRow.select_from_list_name).toBeUndefined()

    it 'is not treated as a select question, so it gets no choice list', () ->
      survey = $model.Survey.loadDict({
        survey: [
          {type: 'select_one_external', select_from_list_name: 'regions', name: 'region', label: 'Region'}
        ]
      })
      row = survey.rows.at(0)
      expect(row._isSelectQuestion()).toBe(false)
      expect(survey.toFlatJSON().choices).toBeUndefined()

    it 'does not block the rest of the form from loading', () ->
      survey = $model.Survey.loadDict({
        survey: [
          {type: 'text', name: 'q1', label: 'Q1'},
          {type: 'select_one_external', select_from_list_name: 'regions', name: 'region', label: 'Region'},
          {type: 'text', name: 'q2', label: 'Q2'}
        ]
      })
      names = []
      survey.forEachRow ((r) -> names.push r.getValue('name')), includeErrors: true
      expect(names).toEqual(['q1', 'region', 'q2'])

  describe 'survey.tests: types we know of but cannot edit', () ->
    # These are valid XLSForm types that Form Builder has no editor for. Before
    # they were registered, each one became a `RowError` and was then dropped
    # from the survey on save, silently deleting the question from the form.
    beforeEach -> window.xlfHideWarnings = true
    afterEach -> window.xlfHideWarnings = false

    UNEDITABLE_TYPES = [
      'email'
      'osm'
      'percentage'
      'phone number'
      'number of days in last month'
      'number of days in last six months'
      'number of days in last year'
      'q select'
      'q select1'
      'uri:deviceid'
      'uri:email'
      'uri:phonenumber'
      'uri:simserial'
      'uri:subscriberid'
      'uri:username'
    ]

    loadWithType = (type) ->
      return $model.Survey.loadDict({
        survey: [
          {type: 'text', name: 'before', label: 'Before'},
          {type: type, name: 'q_x', label: 'X'},
          {type: 'text', name: 'after', label: 'After'}
        ]
      })

    UNEDITABLE_TYPES.forEach((type) ->
      describe "'#{type}'", () ->
        it 'loads without becoming an error row', () ->
          row = loadWithType(type).rows.at(1)
          expect(row.isError()).toBe(false)
          expect(row.get('type').get('typeId')).toBe(type)

        it 'is marked as unsupported by UI', () ->
          row = loadWithType(type).rows.at(1)
          expect(row.get('type').get('rowType').supportedByUI).toBe(false)

        it 'is kept, with its type intact, when the form is saved', () ->
          savedRows = loadWithType(type).toFlatJSON().survey
          expect((row.type for row in savedRows)).toEqual(['text', type, 'text'])

        it 'gets no choice list', () ->
          survey = loadWithType(type)
          # A type containing a space used to have its second word read as a list
          # name, which is how these types failed to be found in the first place
          expect(survey.rows.at(1).get('type').get('listName')).toBeUndefined()
          expect(survey.toFlatJSON().choices).toBeUndefined()
      return
    )
