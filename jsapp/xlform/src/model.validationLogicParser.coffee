$factory = require('./model.validationLogicParserFactory')

module.exports = do ->
  equalityCriterionPattern =
    /(\.)\s*(=|!=|<|>|<=|>=)\s*\'?((?:date\(\'\d{4}-\d{2}-\d{2}\'\)|[\s\w]+|-?\d+)\.?\d*)\'?/

  existenceCriterionPattern =
    /(\.)\s*((?:=|!=)\s*(?:NULL|''))/i

  criteriaJoinPattern =
    `/ and | or /gi`

  selectMultiplePattern =
    /selected\((\.)\s*,\s*\'(\w+)\'\)/

  $factory(equalityCriterionPattern,
            existenceCriterionPattern,
            criteriaJoinPattern,
            selectMultiplePattern)
