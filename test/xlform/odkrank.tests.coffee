# {expect} = require('../helper/fauxChai')
{expect} = require('chai')

$survey = require("../../jsapp/xlform/src/model.survey")

ODKRANK_SURVEY = () =>
  {
    survey: [
      {
        # select_one is a placeholder for odkrank because
        # new rank question is structured more like a select question than
        # like a group (begin_rank/end_rank)
        type: 'odkrank',
        select_from_list_name: 'colors',
        name: 'colors',
        label: 'Favorite color',
      }
    ],
    choices: [
      {
        list_name: 'colors',
        value: 'red',
        label: 'Red'
      },
      {
        list_name: 'colors',
        value: 'yellow',
        label: 'Yellow'
      },
      {
        list_name: 'colors',
        value: 'blue',
        label: 'Blue'
      }
    ]
  }

rank_surv = (randomize=false) =>
  obj = ODKRANK_SURVEY()
  if randomize
    obj.survey[0].randomize = randomize
  $survey.Survey.load(obj)

describe 'survey with a question of type=odkrank (new rank question)', =>
  it 'imports without error', =>
    expect(rank_surv).not.to.throw()

  it 'toFlatJSON() works', =>
    survey = rank_surv()
    json = survey.toFlatJSON()

    row = json.survey[0]
    expect(row.select_from_list_name).not.to.be.a('undefined')
    expect(row.type).to.equal('odkrank')
    expect(row.select_from_list_name).to.equal('colors')

    expect(json.choices).not.to.be.a('undefined')
    expect(json.choices.length).to.equal(3)

    ch_arr = json.choices.map (opt)=>
      {
        list_name: opt.list_name,
        value: opt.value,
        label: opt.label,
      }

    expect(ch_arr).to.eql(ODKRANK_SURVEY().choices)

  describe 'model.survey.Survey object is properly built', =>
    it 'and row has correct type', =>
      survey = rank_surv()
      rr = survey.rows.at(0)
      _type = rr.getTypeId()
      expect(_type).to.equal('odkrank')
      _listName = rr.get('select_from_list_name').getValue()
      expect(_listName).to.equal('colors')

    describe 'with randomize property', =>
      it 'and row can have randomize property', =>
        survey = rank_surv('true')
        rr = survey.rows.at(0)
        _randomize_attr = rr.getValue('randomize')
        expect(_randomize_attr).to.equal('true')

      it 'and exported row has randomize property set', =>
        survey = rank_surv('true')
        json = survey.toFlatJSON()
        expect(json.survey[0].randomize).to.equal('true')

    it 'and associated choice list is correct', =>
      survey = rank_surv()
      rr = survey.rows.at(0)
      _list = rr.getList()
      expect(_list).not.to.be.a('undefined')
      options = []
      rr.getList().options.forEach (option)=>
        options.push({
          value: option.get('value'),
          label: option.get('label'),
        })
      expect(options).to.eql([
        {
          value: "red"
          label: "Red"
        },
        {
          value: "yellow"
          label: "Yellow"
        },
        {
          value: "blue"
          label: "Blue"
        },
      ])
