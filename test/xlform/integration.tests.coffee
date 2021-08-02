{expect} = require('../helper/fauxChai')

$view = require("../../jsapp/xlform/src/_view")
$model = require("../../jsapp/xlform/src/_model")
$surveys = require("../fixtures/xlformSurveys")

# test end-to-end of the system
do ->
  describe 'integration.tests; necessary plugins are installed', ->
    it 'has select2', ->
      expect(jQuery.fn.select2).toBeDefined()

  describe 'integration.tests; integration of SurveyApp', ->
    beforeEach ->
      @load_csv = (scsv)=>
        @div.remove()  if @div
        @survey = $model.Survey.load(scsv)
        @div = $('<div>', class: 'test-div')
        @div.prependTo('body')
        @app = new $view.SurveyApp({survey: @survey, ngScope: {}})
        @div.append @app.$el
        @app.render()
      @ensure_selectrow = (el, classname='js-select-row--force', attachToClassname='js-select-row')->
        $el = $(el)
        $el.find(".#{attachToClassname}").eq(0).addClass(classname)
        $el.find(".#{classname}").eq(0)
      @viewedNames = =>
        names = []
        surv = @survey
        @div.find('.survey__row').each ->
          names.push surv.findRowByCid($(@).data('rowId')).get('name').get('value')
        names
      @surveyNames = ->
        names = []
        getName = (r)-> names.push r.get('name').get('value')
        @survey.forEachRow(getName, includeGroups: true)
        names
      @load_group_csv = ()=>
        @load_csv(
          survey: [
            ['type'        , 'name' , 'label'           ]
            #--------------------------------------------
            ['text'        , 'q1'   , 'Question1'       ]
            ['begin group' , 'grp'                      ]
            ['text'        , 'g1q1' , 'Group1Question1' ]
            ['text'        , 'g1q2' , 'Group1Question2' ]
            ['end group'                                ]
          ]
        )
    afterEach ->
      $('.test-div').remove()

    describe 'represents required checkbox properly', ->
      beforeEach ->
        @load_csv("""
          survey,,,
          ,type,name,label,required
          ,text,q1,Question1,true
          ,text,q2,Question2,false
          """)
        @expectReqCheckbox = (r0)->
          r0.find('.js-advanced-toggle').eq(0).click()
          box = r0.find('.xlf-dv-required').find('input[type=checkbox]')
          expect(box.prop('checked'))

      it 'works with imported questions', ->
        @div.find('.js-advanced-toggle').eq(0).click()
        rows = @div.find('.survey__row')
        @expectReqCheckbox(rows.eq(0)).toBe(true)
        @expectReqCheckbox(rows.eq(1)).toBe(false)
        ``
      it 'new text questions marked as required', ->
        @app.survey.rows.add(type: 'text', label: 'hello world')
        last_row = @app.survey.rows.last()
        last_row_reqd = last_row.getValue('required')
        # depends on model configs
        # expect(last_row_reqd).toBe(true)
        @expectReqCheckbox(@div.find('.survey__row').eq(2)).toBe(last_row_reqd)

      it 'new gps questions not marked as required', ->
        @app.survey.rows.add(type: 'geopoint', label: 'hello world')
        last_row = @app.survey.rows.last()
        last_row_reqd = last_row.getValue('required')
        # depends on model configs
        expect(last_row_reqd).toBe(false)
        @expectReqCheckbox(@div.find('.survey__row').eq(2)).toBe(last_row_reqd)

      it 'new geotrace questions not marked as required', ->
        @app.survey.rows.add(type: 'geotrace', label: 'hello world')
        last_row = @app.survey.rows.last()
        last_row_reqd = last_row.getValue('required')
        # depends on model configs
        expect(last_row_reqd).toBe(false)
        @expectReqCheckbox(@div.find('.survey__row').eq(2)).toBe(last_row_reqd)

      it 'new geoshape questions not marked as required', ->
        @app.survey.rows.add(type: 'geoshape', label: 'hello world')
        last_row = @app.survey.rows.last()
        last_row_reqd = last_row.getValue('required')
        # depends on model configs
        expect(last_row_reqd).toBe(false)
        @expectReqCheckbox(@div.find('.survey__row').eq(2)).toBe(last_row_reqd)

    it 'has group html structure', ->
      @load_group_csv()
      expect(@survey.rows.length).toBe(2)
      ul = @div.find('.survey-editor__list').eq(0)
      expect(ul.find('> .survey__row').length).toBe(2)
      survey__row__item_group = ul.find('> .survey__row').eq(1)
      group__rows = survey__row__item_group.find('.group__rows')
      expect(group__rows.find('> .survey__row').length).toBe(2)

    it 'has selectable rows', ->
      @load_group_csv()
      rowItems = @div.find('.survey-editor__list > .survey__row')
      row1 = rowItems.eq(0)
      jsSelectRow1 = @ensure_selectrow(row1)

      expect(@app.selectedRows().length).toBe(0)
      jsSelectRow1.click()
      expect(@app.selectedRows().length).toBe(1)
      expect(@div.find('.survey-editor__list > .survey__row').length).toBe(2)

    it 'has selectable groups', ->
      @load_csv """
      survey,,,
      ,type,name,label
      ,begin group,grp,Group1
      ,text,q1,Q1
      ,end group
      """
      expect(@div.find('.survey__row--selected').length).toBe(0)
      jsSelectRow1 = @ensure_selectrow(@div)
      jsSelectRow1.click()
      expect(@div.find('.survey__row--selected').length).toBe(1)
    describe 'row reordering', ->
      describe 'basic rows', ->
        beforeEach ->
          @load_csv """
          survey,,,
          ,type,name,label
          ,text,qa,QuestionA
          ,text,qb,QuestionB
          ,text,qc,QuestionC
          """

        it 'can switch ABC -> ACB', ->
          surv = @app.survey
          expect(@viewedNames()).toEqual(['qa','qb','qc'])
          expect(@surveyNames()).toEqual(['qa','qb','qc'])
          [$a, $b, $c] = ($(x)  for x in @div.find('.survey__row'))

          $a.after $c.detach()

          [prev, par] = @app._getRelatedElIds($c)
          expect(par).not.toBeDefined()
          expect(prev).toBe($a.data('rowId'))

          $c.trigger('survey__row-sortablestop', $c.data('rowId'))

          expect(@viewedNames()).toEqual(['qa','qc','qb'])
          expect(@surveyNames()).toEqual(['qa','qc','qb'])

    describe 'question type behavior', ->
      beforeEach ->
        @expectRowDefinedValues = (r)->
          outObj = {}
          for k, v of r.toJSON() when v
            outObj[k] = v
          expect(outObj)

        @load_csv """
        survey,,,
        ,type,name,label
        ,text,q1,Question1
        """
      it 'for calculation question through the interface', ->
        click_set_val = (v)->
          survey_row.find('.js-card-label').eq(0).click()
          inp = survey_row.find('input').eq(0)
          inp.val(v)
          inp.blur()

        @div.find('.js-expand-row-selector').eq(-1).click()
        line = @div.find('.survey__row .line').eq(0)
        line.find('input').eq(0).val("4 + 4")
        line.find('button').eq(0).click()

        # Preview value is correct
        expect(line.find('.row__questiontypes__new-question-name').val()).toBe("4 + 4")
        line.find(".questiontypelist__item[data-menu-item='calculate']").click()

        expectedLastRow =
          type: 'calculate'
          calculation: '4 + 4'
          name: 'calculation'
          required: 'false'
        @expectRowDefinedValues(@survey.rows.last()).toEqual(expectedLastRow)

        survey_row = @div.find('.survey__row').eq(-1)

        expect(survey_row.find('.js-card-label').text()).toBe("4 + 4")
        click_set_val("5 + 5")
        expect(survey_row.find('.js-card-label').text()).toBe("5 + 5")

        expectedLastRow =
          type: 'calculate'
          calculation: '5 + 5'
          name: 'calculation'
          required: 'false'
        @expectRowDefinedValues(@survey.rows.last()).toEqual(expectedLastRow)

        ``
    describe 'ranking and scoring questions', ->
      beforeEach ->
        @create_rank_survey = ()=>
          @load_csv(
            survey: [
              ['type'       , 'name', 'label'           , 'kobo--rank-items'],
              #--------------------------------------------------------------
              ['text'       , 'tx1' , 'text question1'  ]
              ['begin rank' , 'rnk' , 'Rank these items', 'item-choices']
              ['rank__level', 'n1'  , 'First choice'    ]
              ['rank__level', 'n2'  , 'Second choice'   ]
              ['end rank'                               ]
              ['text'       , 'tx2' , 'text question2'  ]
            ]
            choices: [
              ['list name'    , 'name', 'label' ]
              ['item-choices' , 'i1'  , 'Item 1']
              ['item-choices' , 'i2'  , 'Item 2']
              ['item-choices' , 'i3'  , 'Item 3']
              ['item-choices' , 'i4'  , 'Item 4']
            ]
          )
      it 'can have a ranking q', ->
        @create_rank_survey()

    describe 'grouping selected rows', ->
      beforeEach ->
        @load_csv """
        survey,,,
        ,type,name,label
        ,text,q1,Question1
        ,begin group,grp,
        ,text,g1q1,Group1Question1
        ,text,g1q2,Group1Question2
        ,end group,,
        ,text,q2,Question2
        ,text,q3,Question3
        ,text,q4,Question4
        """

      it 'can view group settings', ->
        $groupEl = @div.find('.group').eq(0)
        $groupEl.find('.js-toggle-group-settings').click()
        $groupSettings = $groupEl.find('.card__settings').eq(0)
        expect($groupSettings.find('.xlf-dv-name').find('input').length).toBe(1)
        ``

      it 'can group all rows and groups together', ->
        firstLevelRows = @div.find('.survey-editor__list > .survey__row')
        expect(firstLevelRows.length).toBe(5)
        firstLevelRows.addClass('survey__row--selected')
        expect(@app.selectedRows().length).toBe(5)

        # set the btn-disabled on btn--group-questions
        @app.questionSelect()
        expect(@div.find('.btn--group-questions').hasClass('btn--disabled')).not.toBeTruthy()

        @app.groupSelectedRows()
        expect(@app.survey.rows.at(0).getValue('type')).toBe('group')
        expect(@div.find('.survey-editor__list > .survey__row--group').length).toBe(1)

        # reset the btn-disabled on btn--group-questions
        @app.questionSelect()
        expect(@div.find('.btn--group-questions').hasClass('btn--disabled')).toBeTruthy()

        @div.find('.survey-editor__list > .survey__row--group').addClass('survey__row--selected')
        @app.questionSelect()
        expect(@div.find('.survey-editor__list > .survey__row--group').length).toBe(1)
        expect(@div.find('.survey-editor__list > .survey__row').length).toBe(1)

      # it 'places group at the correct part of the survey', ->
      #   @app.$el.find('.survey__row').eq(0).addClass('survey__row--selected')
      #   @app.groupSelectedRows()
      #   newGroupCid = @app.survey.rows.at(0).cid
      #   expect(@app.$el.find('.survey__row').eq(0).data('rowId')).toBe(newGroupCid)

      it 'can group discontinuous questions', ->
        firstLevelRows = @div.find('.survey-editor__list > .survey__row')
        firstLevelRows.eq(0).addClass('survey__row--selected')
        firstLevelRows.eq(-1).addClass('survey__row--selected')
        expect(@app.selectedRows().length).toBe(2)
        @app.groupSelectedRows()
        # dump @survey.toCSV()
    describe 'tests of small groups', ->
      beforeEach ->
        @load_csv """
        survey,,,
        ,type,name,label
        ,begin group,grp,
        ,text,g1q1,Group1Question1
        ,text,g1q2,Group1Question2
        ,end group,,
        """
      it 'can group and break apart', ->
        @div.find('.js-delete-group').addClass('js-force-delete-group').eq(0).click()

        firstLevelRows = @div.find('.survey-editor__list > .survey__row')
        expect(firstLevelRows.length).toBe(2)

        firstLevelRows.addClass('survey__row--selected')
        expect(@app.selectedRows().length).toBe(2)

        @app.groupSelectedRows()

        # there should be one "first-level row": the group
        firstLevelRows = @div.find('.survey-editor__list > .survey__row')
        expect(firstLevelRows.length).toBe(1)

        # split is apart again
        @div.find('.js-delete-group').addClass('js-force-delete-group').eq(0).click()
        firstLevelRows = @div.find('.survey-editor__list > .survey__row')
        expect(firstLevelRows.length).toBe(2)
        ``
