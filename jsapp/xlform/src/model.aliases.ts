// 📘 generated from ./model.aliases.civet 

var _; var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
_ = require('underscore')

module.exports = (function() {
  var aliases_dict, aliases, q
  aliases_dict = {
    group: [
      'begin group',
      'end group',
      'begin_group',
      'end_group',
    ],
    repeat: [
      'begin repeat',
      'end repeat',
      'begin_repeat',
      'end_repeat',
    ],
    kobomatrix: [
      'begin_kobomatrix',
      'end_kobomatrix',
    ],
    score: [
      'begin score',
      'end score',
      'begin_score',
      'end_score',
    ],
    rank: [
      'begin_rank',
      'end_rank',
      'begin rank',
      'end rank',
    ],
  }

  aliases = function(name){ return aliases_dict[name] || [name] }

  q = {}
  q.groupable = function(){
    return _.flatten([
      aliases('group'),
      aliases('repeat'),
      aliases('score'),
      aliases('rank'),
      aliases('kobomatrix'),
    ])
  }

  q.groupsOrRepeats = function(){
    return _.flatten([aliases('group'), aliases('repeat')])
  }

  q.requiredSheetNameList = function(){
    return ['survey']
  }

  q.testGroupable = function(type){
    
    
    var out
    // Returns an object if type is group or repeat (begin or end)
    //  otherwise, returns false
    out = false
    if (indexOf.call(aliases_dict.group, type) >= 0) {
      out = {type: 'group'}
    } else if (indexOf.call(aliases_dict.repeat, type) >= 0) {
      out = {type: 'repeat'}
    } else if (indexOf.call(aliases_dict.score, type) >= 0) {
      out = {type: 'score'}
    } else if (indexOf.call(aliases_dict.rank, type) >= 0) {
      out = {type: 'rank'}
    } else if (indexOf.call(aliases_dict.kobomatrix, type) >= 0) {
      out = {type: 'kobomatrix'}
    }
    if (out && out.type) {
      out.begin = !type.match(/end/)
    }
    return out
  }

  q.testGroupOrRepeat = function(type){
    console.error('q.testGroupOrRepeat is renamed to q.testGroupable')
    return q.testGroupable(type)
  }

  q.hiddenTypes = function(){
    return _.flatten([
      ['imei', 'deviceid'],
      ['start'],
      ['end'],
      ['today'],
      ['simserial'],
      ['subscriberid'],
      ['phonenumber', 'phone_number'],
      ['audit'],
    ])
  }

  aliases.custom = q

  aliases.q = aliases.custom
  return aliases
})()
