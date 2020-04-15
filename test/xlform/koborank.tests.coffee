{expect} = require('chai')

$survey = require("../../jsapp/xlform/src/model.survey")

KOBORANK_SURVEY = () =>
  {
    survey: [
      {
        type: 'begin_koborank',
        # select_from_list_name: 'colors',
        'kobo--rank-items': 'colors',
        'kobo--rank-constraint-message': 'cannot select twice',
        name: 'colors',
        label: 'Favorite color'
      },
      {
        type: 'rank__level',
        label: '1st choice',
        name: 'choice1'
      },
      {
        type: 'rank__level',
        label: '2nd choice',
        name: 'choice2'
      },
      {
        type: 'end_koborank',
      }
    ],
    choices: [
      {
        list_name: 'colors',
        value: 'boston',
        label: 'Boston'
      },
      {
        list_name: 'colors',
        value: 'montreal',
        label: 'Montreal'
      },
      {
        list_name: 'colors',
        value: 'baltimore',
        label: 'Baltimore'
      }
    ]
  }


koborank_surv = () => $survey.Survey.load(KOBORANK_SURVEY())

describe 'survey with a question of type=koborank (legacy rank question)', =>
  it 'imports without error', =>
    expect(koborank_surv).not.to.throw()

  it 'toFlatJSON() works', =>
    survey = koborank_surv()
    json = survey.toFlatJSON()
    row = json.survey[0]
    expect(row['kobo--rank-items']).to.equal('colors')
    expect(json.choices.map(
      (opt) =>
        {
          list_name: opt.list_name,
          value: opt.value,
          label: opt.label,
        }
    )).to.eql(KOBORANK_SURVEY().choices)

  describe 'model.survey.Survey object is properly built', =>
    it 'and row has correct type', =>
      survey = koborank_surv()
      rr = survey.rows.at(0)
      _type = rr.getTypeId()
      expect(_type).to.equal('koborank')
      _listName = rr.get('kobo--rank-items').getValue()
      expect(_listName).to.equal('colors')

    it 'and associated choice list is correct', =>
      survey = koborank_surv()
      rr = survey.rows.at(0)
      _list = rr.getList()
      expect(_list).not.to.be.a('undefined')
      options = []
      rr.getList().options.forEach (option)=>
        options.push({
          value: option.get('value'),
          label: option.get('label'),
        })
      o_choices = KOBORANK_SURVEY().choices.map((cc) =>
        delete cc.list_name
        cc
      )
      expect(options).to.eql(o_choices)
