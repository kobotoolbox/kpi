_ = require 'underscore'

module.exports = do ->
  aliases_dict =
    group: [
        "begin group"
        "end group"
        "begin_group"
        "end_group"
      ],
    repeat: [
        "begin repeat"
        "end repeat"
        "begin_repeat"
        "end_repeat"
      ]
    score: [
        "begin score",
        "end score",
      ]
    rank: [
        "begin rank",
        "end rank",
      ]

  aliases = (name)-> aliases_dict[name] or [name]

  q = {}
  q.groupable = ()->
    _.flatten [aliases('group'), aliases('repeat'), aliases('score'), aliases('rank')]

  q.groupsOrRepeats = ()->
    _.flatten [aliases('group'), aliases('repeat')]

  q.requiredSheetNameList = ()->
    ['survey']

  q.testGroupable = (type)->
    # Returns an object if type is group or repeat (begin or end)
    #  otherwise, returns false
    out = false
    if type in aliases_dict.group
      out = {type: 'group'}
    else if type in aliases_dict.repeat
      out = {type: 'repeat'}
    else if type in aliases_dict.score
      out = {type: 'score'}
    else if type in aliases_dict.rank
      out = {type: 'rank'}
    if out and out.type
      out.begin = !type.match(/end/)
    out

  q.testGroupOrRepeat = (type)->
    console.error("q.testGroupOrRepeat is renamed to q.testGroupable")
    q.testGroupable(type)

  q.hiddenTypes = ()->
    _.flatten [
      ['imei', 'deviceid'],
      ['start'],
      ['end'],
      ['today'],
      ['simserial'],
      ['subscriberid'],
      ['phonenumber'],
    ]

  aliases.custom = q

  aliases.q = aliases.custom
  aliases