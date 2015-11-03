$factory = require('./model.validationLogicParserFactory')

module.exports = do ->
  equalityCriterionPattern =
    /^\${(\w+)}\s*(=|!=|<|>|<=|>=)\s*\'?((?:date\(\'\d{4}-\d{2}-\d{2}\'\)|[\s\w]+|-?\d+)\.?\d*)\'?/

  existenceCriterionPattern =
    /\${(\w+)}\s*((?:=|!=)\s*(?:NULL|''))/i

  criteriaJoinPattern =
    `/ and | or /gi`

  selectMultiplePattern =
    /selected\(\$\{(\w+)\},\s*\'(\w+)\'\)/

  $factory(equalityCriterionPattern,
            existenceCriterionPattern,
            criteriaJoinPattern,
            selectMultiplePattern)
