$factory = require('./model.validationLogicParserFactory')

module.exports = do ->
  equalityCriterionPattern = ///
      (\.)\s*                            # always a leading dot
      (!=|<=|>=|=|<|>)\s*                # operator (careful: if < is listed before <=, the = will be treated as part of the value)
      (                                  # start of the value group
        (?:                              #   start of a non-matching group
          date\(\'\d{4}-\d{2}-\d{2}\'\)) #     something resembling a date: date('xxxx-xx-xx')
        |                                #   or
          (?:-?(?:\d+\.\d+|\.\d+|\d+.?)) #     a signed integer or decimal
        |                                #   or
          (?:\'[^']+\')                  #     a string surrounded by single quotes (careful: the quotes are included in the match!)
      )                                  # end of the value group
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
