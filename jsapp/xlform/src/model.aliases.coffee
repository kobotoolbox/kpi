_ = require 'underscore'

module.exports = do ->
  aliases_dict = {
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
    kobomatrix: [
      "begin_kobomatrix"
      "end_kobomatrix"
    ]
    score: [
      "begin score",
      "end score",
      "begin_score",
      "end_score",
    ]
    rank: [
      "begin_rank",
      "end_rank",
      "begin rank",
      "end rank",
    ]
  }

  aliases = (name)-> aliases_dict[name] or [name]

  q = {}
  q.groupable = ()->
    _.flatten [
                aliases('group')
                aliases('repeat')
                aliases('score')
                aliases('rank')
                aliases('kobomatrix')
              ]

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
    else if type in aliases_dict.kobomatrix
      out = {type: 'kobomatrix'}
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
      ['phonenumber', 'phone_number'],
      ['audit'],
    ]

  aliases.custom = q

  aliases.q = aliases.custom
  aliases
