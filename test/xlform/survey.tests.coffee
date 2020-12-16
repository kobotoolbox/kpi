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
      expect(survey.rows.length).to.equal(1)
      lastRow = survey.rows.at(0)
      expect(lastRow.get('name').get('value')).to.equal('')
      expect(lastRow.get('label').get('value')).to.equal('how many people?')
      lastRow.finalize()
      expect(lastRow.get('name').get('value')).to.equal('how_many_people')

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
        @expectValue('required').to.equal(false)
      it 'select one is required', ->
        @populateRow(type: 'select_one')
        @expectValue('required').to.equal(false)
      it 'integer is required', ->
        @populateRow(type: 'integer')
        @expectValue('required').to.equal(false)
      it 'geopoint is not required', ->
        @populateRow(type: 'geopoint')
        @expectValue('required').to.equal(false)
      it 'geotrace is not required', ->
        @populateRow(type: 'geotrace')
        @expectValue('required').to.equal(false)
      it 'geoshape is not required', ->
        @populateRow(type: 'geoshape')
        @expectValue('required').to.equal(false)
      it 'note is not required', ->
        @populateRow(type: 'note')
        @expectValue('required').to.equal(false)

    it 'has a valid empty survey', ->
      expect(@survey.toCSV()).not.to.be.a('undefined')
    it 'can add rows to the survey', ->
      @survey.rows.add type: 'text', name: 'q1'
      expect(@survey.rows.at(0).toJSON().name).to.equal('q1')
      @survey.rows.add type: '_errortype', name: 'q2'
      expect(@survey.rows.at(1).toJSON().type).to.equal('_errortype')
      @survey.rows.add type: 'note', name: 'q3'
      expect(@survey.rows.at(2).toJSON().type).to.equal('note')

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
          ['type', 'name', 'label']).to.deep.equal(['text', 'q1', 'Question1'])

    it 'loads a multiple choice survey', ->
      @_load_csv(surveys.withChoices)
      _results = @survey.toJSON()
      for row in _results.survey
        expect(row['$kuid']).not.to.be.a('undefined')
        delete row['$kuid']
      expect(_results).to.deep.equal({
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
        expect(@surveyNames()).to.deep.equal(['qa', 'qb', 'qc'])
        [qa, qb, qc] = @survey.rows.models
        _parent = qa._parent
        @survey._insertRowInPlace(qc, previous: qa)
        expect(qc._parent).to.equal(_parent)
        expect(@surveyNames()).to.deep.equal(['qa', 'qc', 'qb'])

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
        expect(names).to.deep.equal('q1 g1q1 g1q2 q8 q9'.split(' '))

      it 'runs flat', ->
        # when flat:true option is passed, it will not iterate through
        # any nested groups
        options =
          flat: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).to.deep.equal('q1 q8 q9'.split(' '))

      it 'runs with includeGroups', ->
        # when includeGroups:true , it will include the group and the nested
        # values
        options =
          includeGroups: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).to.deep.equal('q1 grp g1q1 g1q2 q8 q9'.split(' '))

      it 'runs with includeGroups', ->
        # when includeGroups:true , it will include the group and the nested
        # values
        options =
          includeGroups: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).to.deep.equal('q1 grp g1q1 g1q2 q8 q9'.split(' '))

      it 'runs with includeErrors', ->
        # when includeErrors:true, it will include erroneous rows
        options =
          includeErrors: true

        @survey.forEachRow @getProp('name', names = []), options
        expect(names).to.deep.equal('q1 g1q1 g1q2 q8 q9 err'.split(' '))


  describe 'survey.tests: form_id auto-naming', () ->
    describe 'initialization', () ->
      it 'enables auto-naming when form is new', () ->
        survey = new $model.Survey()
        expect(survey.settings.auto_name).to.equal true
    describe 'change:form_id', () ->
      it 'disables auto naming when changed manually', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_id', 'test'

        expect(settings.auto_name).to.equal false
      it 'ignores when changed as part of a title change', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_title', 'test'

        expect(settings.auto_name).to.equal true
    describe 'change:form_title', () ->
      it 'sets the form id when form in auto naming mode', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_title', 'test'

        expect(settings.get('form_id')).to.equal 'test'
      it 'sluggifies label before setting id', () ->
        settings = new $model.Settings()
        settings.enable_auto_name()
        settings.set 'form_title', 'test me'

        expect(settings.get('form_id')).to.equal 'test_me'

  describe 'survey.tests: prep_cols', () ->
    it 'flattens and deduplicates arrays of strings', () ->
      survey = new $model.Survey()
      expect(survey.prepCols [['a', 'b'], ['b', 'c'], ['e', 'a', 'd']]).to.deep.equal ['a', 'b', 'c', 'e', 'd']

    it 'excludes passed array of strings from result', () ->
      survey = new $model.Survey()
      expect(survey.prepCols [['a', 'b'], ['b', 'c'], ['e', 'a', 'de']], exclude: ['de']).to.deep.equal ['a', 'b', 'c', 'e']

    it 'add passed string to result', () ->
      survey = new $model.Survey()
      expect(survey.prepCols [['a', 'b'], ['b', 'c'], ['e', 'a', 'de']], exclude: ['de'], add: ['abc']).to.deep.equal ['a', 'b', 'c', 'e', 'abc']
