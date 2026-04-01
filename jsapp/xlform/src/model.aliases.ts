// 📘 generated from ./model.aliases.civet 

var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
import _ from 'underscore'

const aliases_dict = {
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

const aliases = (name: string) => aliases_dict[name as keyof typeof aliases_dict] || [name]

const q = {
  groupable() {
    return _.flatten([
      aliases('group'),
      aliases('repeat'),
      aliases('score'),
      aliases('rank'),
      aliases('kobomatrix'),
    ])
  },

  groupsOrRepeats() {
    return _.flatten([aliases('group'), aliases('repeat')])
  },

  requiredSheetNameList() {
    return ['survey']
  },

  testGroupable(type: string) {
    // Returns an object if type is group or repeat (begin or end)
    //  otherwise, returns false
    let out
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
    if (!out) return false

    const begin = !type.match(/end/)
    return { begin, ...out }
  },

  testGroupOrRepeat(type: string) {
    console.error('q.testGroupOrRepeat is renamed to q.testGroupable')
    return q.testGroupable(type)
  },

  hiddenTypes() {
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
  },
}

aliases.custom = aliases.q = q

export default aliases

