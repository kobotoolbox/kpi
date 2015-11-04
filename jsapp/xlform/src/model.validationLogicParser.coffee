$factory = require('./model.validationLogicParserFactory')

module.exports = do ->
  # /(\.)\s*(=|!=|<|>|<=|>=)\s*\'?((?:date\(\'\d{4}-\d{2}-\d{2}\'\)|[\s\w]+|-?\d+)\.?\d*)\'?/
  equalityCriterionPattern = ///
      (\.)\s*
      (=|!=|<|>|<=|>=)\s*
      \'?
      (
        (?:
          date\(\'\d{4}-\d{2}-\d{2}\'\)
        |
          [\s\w]+|-?\d+
        )
        \.?\d*
      )
      \'?
    ///

  # /(\.)\s*((?:=|!=)\s*(?:NULL|''))/i
  existenceCriterionPattern = ///
      (\.)\s*
      (
        (?:=|!=)
        \s*
        (?:NULL|'')
      )
    ///i

  # / and | or /gi
  criteriaJoinPattern =
    ///#{' and '}|#{' or '}///gi

  # /selected\((\.)\s*,\s*\'(\w+)\'\)/
  selectMultiplePattern = ///
      selected\(
        (\.)\s*
        ,\s*\'
        (\w+)\'
      \)
    ///

  $factory(equalityCriterionPattern,
            existenceCriterionPattern,
            criteriaJoinPattern,
            selectMultiplePattern)
