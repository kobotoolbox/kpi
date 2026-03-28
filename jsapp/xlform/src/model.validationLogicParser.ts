// 📘 generated from ./model.validationLogicParser.civet 
import $factory from './model.validationLogicParserFactory'

const equalityCriterionPattern = /(\.)\s*(!=|<=|>=|=|<|>)\s*((?:date\(\'\d{4}-\d{2}-\d{2}\'\))|(?:-?(?:\d+\.\d+|\.\d+|\d+.?))|(?:\'[^']+\'))/

// /(\.)\s*((?:=|!=)\s*(?:NULL|''))/i
const existenceCriterionPattern = /(\.)\s*((?:=|!=)\s*(?:NULL|''))/i

// / and | or /gi
const criteriaJoinPattern
  = RegExp(`${' and '}|${' or '}`, 'gi')

// /selected\((\.)\s*,\s*\'(\w+)\'\)/
const selectMultiplePattern = /selected\((\.)\s*,\s*\'(\w+)\'\)/

const validationLogicParser = $factory(
  equalityCriterionPattern,
  existenceCriterionPattern,
  criteriaJoinPattern,
  selectMultiplePattern,
)

export default validationLogicParser
