{expect} = require('../helper/fauxChai')

$aliases = require('../../jsapp/xlform/src/model.aliases')

module.exports = do ->
  expectSorted = (q)->
    unless q instanceof Array
      throw new Error("aliases.tests:expectSorted needs an array")
    q.sort()
    expect(q)

  describe '$aliases', ->
    describe 'returns correct results from', ->
      describe 'basic queries', ->
        it '[groups]', ->
          expectSorted($aliases('group')).toEqual([
            'begin group',
            'begin_group',
            'end group',
            'end_group',
            ])
        it '[repeats]', ->
          expectSorted($aliases('repeat')).toEqual([
            'begin repeat',
            'begin_repeat',
            'end repeat',
            'end_repeat',
            ])
    describe 'custom queries', ->
      it '[groupsOrRepeats]', ->
        expectSorted($aliases.q.groupsOrRepeats()).toEqual([
          'begin group',
          'begin repeat',
          'begin_group',
          'begin_repeat',
          'end group',
          'end repeat',
          'end_group',
          'end_repeat',
          ])

      it '[groupable]', ->
        expectSorted($aliases.q.groupable()).toEqual([
          'begin group',
          'begin rank',
          'begin repeat',
          'begin score',
          'begin_group',
          'begin_kobomatrix',
          'begin_rank',
          'begin_repeat',
          'begin_score',
          'end group',
          'end rank',
          'end repeat',
          'end score',
          'end_group',
          'end_kobomatrix',
          'end_rank',
          'end_repeat',
          'end_score',
          ])
      it '[availableSheetNames]', ->
        expectSorted($aliases.q.requiredSheetNameList()).toEqual([
          'survey',
          ])
      it '[hidden_types]', ->
        expect($aliases.q.hiddenTypes()).toContain('imei')
      describe 'q.testGroupOrRepeat', ->
        expectGroupableParse = (s)->
          expect($aliases.q.testGroupable(s))
        it 'parses group properly', ->
          expectGroupableParse('begin group').toEqual({type: 'group', begin: true})
          expectGroupableParse('begin_group').toEqual({type: 'group', begin: true})
          expectGroupableParse('end group').toEqual({type: 'group', begin: false})
          expectGroupableParse('end_group').toEqual({type: 'group', begin: false})
        it 'parses repeat properly', ->
          expectGroupableParse('begin repeat').toEqual({type: 'repeat', begin: true})
          expectGroupableParse('begin_repeat').toEqual({type: 'repeat', begin: true})
          expectGroupableParse('end repeat').toEqual({type: 'repeat', begin: false})
          expectGroupableParse('end_repeat').toEqual({type: 'repeat', begin: false})
