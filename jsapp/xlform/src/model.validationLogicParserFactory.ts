import _ from 'underscore'

export default function validationLogicParserFactory(
  equalityCriterionPattern: RegExp,
  existenceCriterionPattern: RegExp,
  criteriaJoinPattern: RegExp,
  selectMultiplePattern: RegExp,
) {
  function parseCriterion(text: string) {
    var matches = text.match(existenceCriterionPattern)
    if (matches === null) {
      matches = text.match(equalityCriterionPattern)
    }

    if (!!matches) {
      matches[2] = matches[2].replace(/\s+/, '').replace(/null/i, 'NULL')
    } else {
      return parseMultiselectCriterion(text)
    }

    var equalityMapper = {
      '=': 'resp_equals',
      '!=': 'resp_notequals',
      '>': 'resp_greater',
      '<': 'resp_less',
      '>=': 'resp_greaterequals',
      '<=': 'resp_lessequals',
      "!=''": 'ans_notnull',
      "=''": 'ans_null',
    }

    var res = {
      name: matches[1],
      // nit(2026-03-27) low-effort ts assertion
      // operator: equalityMapper[matches[2]],
      operator: equalityMapper[matches[2] as keyof typeof equalityMapper],

    }

    if (matches[3]) {
      // strip surrounding single quotes, if any
      var response_value = matches[3].replace(/^'([^']*)'$/, '$1')
      // extract xxxx-xx-xx from date('xxxx-xx-xx')
      response_value = response_value.replace(/date\('(\d{4}-\d{2}-\d{2})'\)/, '$1')
      return { ...res, response_value }
    }

    return res
  }

  function parseMultiselectCriterion(text: string) {
    var matches = text.match(selectMultiplePattern)

    if (!matches) {
      throw new Error('criterion not recognized: "' + text + '"')
    }

    return {
      name: matches[1],
      operator: text.indexOf('not(') == -1 ? 'multiplechoice_selected' : 'multiplechoice_notselected',
      response_value: matches[2],
    }
  }

  return (text: string) => {
    var criteria = text.split(criteriaJoinPattern),
      criteriaLength = criteria.length,
      joinOperators = text.match(criteriaJoinPattern)

    if (!!joinOperators && _.uniq(joinOperators).length > 1) {
      throw new Error('multiple criteria join operators are not supported at the moment')
    }

    if (criteriaLength === 1) {
      return {
        criteria: [parseCriterion(text)],
      }
    } else {
      return {
        criteria: _.map(criteria, (criterion) => parseCriterion(criterion)),
        // nit(2026-03-27) low-effort ts assertion
        // operator: joinOperators[0].replace(/ /g, '').toUpperCase(),
        operator: joinOperators![0].replace(/ /g, '').toUpperCase(),
      }
    }
  }
}
