$factory = require('./model.validationLogicParserFactory')

### debug method for regexes
err_if_unmatch = (re1, re2)->
  if re1 and re2 and re1.toString() isnt re2.toString()
    console.error ['inputs did not match', re1.toString(), re2.toString()].join '\n'
log_equiv = (i1, i2, i3)->
  console.log([i1.toString()])
  err_if_unmatch(i1, i2) or err_if_unmatch(i2, i3)
  i1
###

module.exports = do ->
  equalityCriterionPattern = ///
      ^\${(\w+)}\s*                      # question reference in the format of ${name}
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

  # /\${(\w+)}\s*((?:=|!=)\s*(?:NULL|''))/i
  existenceCriterionPattern = ///
      \${
        (\w+)
      }\s*
      (
        (?:=|!=)
        \s*
        (?:NULL|'')
      )
    ///i

  # / and | or /gi
  criteriaJoinPattern =
    ///#{' and '}|#{' or '}///gi

  # /selected\(\$\{(\w+)\},\s*\'(\w+)\'\)/
  selectMultiplePattern = ///
      selected\(\$\{
      (\w+)
      \},
      \s*
      \'
      (\w+)
      \'
      \)
    ///

  $factory(equalityCriterionPattern,
            existenceCriterionPattern,
            criteriaJoinPattern,
            selectMultiplePattern)
