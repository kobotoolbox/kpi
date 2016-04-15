###
fixtures of surveys, wrapped in javascript objects.
(Probably overcomplicated, but at the core they're
sample surveys for tests.)
###

class SurveyFixture
  constructor: (@name)->
    @equivs = []
    @invals = []
  _append: (o, att)->
    if o instanceof Array
      @_append(_o, att)  for _o in o
    else
      @[att].push(o)
    @
  equiv: (o...)-> @_append(o, 'equivs')
  inval: (o...)-> @_append(o, 'invals')
  main: (m)->
    if m
      @_main = m
      @
    else
      @_main

surveys = {}

surveys.pizza_survey = do->
  csv = """
  survey,,,
  ,type,name,label
  ,select_one yes_no,likes_pizza,Do you like pizza?
  choices,,,
  ,list name,name,label
  ,yes_no,yes,Yes
  ,yes_no,no,No
  """

  xlf1 =
    survey: [
      type:
        select_one: "yes_no"

      name: "likes_pizza"
      label: "Do you like pizza?"
    ]
    choices:
      yes_no: [
        {
          name: "yes"
          label: "Yes"
        }
        {
          name: "no"
          label: "No"
        }
      ]

  xlf2 =
    survey: [
      type: "select_one yes_no"
      name: "likes_pizza"
      label: "Do you like pizza?"
    ]
    choices:
      yes_no: [
        {
          name: "yes"
          label: "Yes"
        }
        {
          name: "no"
          label: "No"
        }
      ]

  new SurveyFixture("pizza_survey").equiv(xlf1, xlf2, csv).main(xlf1)

surveys.groups = do ->
  csv = """
  survey,,,
  ,type,name,label
  ,text,q1,Question1
  ,begin group,grp,
  ,text,g1q1,Group1Question1
  ,text,g1q2,Group1Question2
  ,end group,,
  """

  xlf1 = survey: [
    {
      type: "text"
      name: "q1"
      label: "Question1"
    }
    {
      type: "begin group"
      name: "grp"
    }
    {
      type: "text"
      name: "g1q1"
      label: "Group1Question1"
    }
    {
      type: "text"
      name: "g1q2"
      label: "Group1Question2"
    }
    {
      type: "end group"
    }
  ]

  xlf2 = survey: [
    {
      type: "text"
      name: "q1"
      label: "Question1"
    }
    {
      type: "group"
      name: "grp"
      rows: [
        {
          type: "text"
          name: "g1q1"
          label: "Group1Question1"
        }
        {
          type: "text"
          name: "g1q2"
          label: "Group1Question2"
        }
      ]
    }
    {
      type: "end group"
    }
  ]

  new SurveyFixture('groups').equiv(csv, xlf1, xlf2).main(xlf1)

module.exports = surveys
