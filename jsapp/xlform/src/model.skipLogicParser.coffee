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
  # /^\${(\w+)}\s*(=|!=|<|>|<=|>=)\s*\'?((?:date\(\'\d{4}-\d{2}-\d{2}\'\)|[\s\w]+|-?\d+)\.?\d*)\'?/
  equalityCriterionPattern = ///
      ^\${(\w+)}\s*
        (=|!=|<|>|<=|>=)
        \s*\'?
        (
          (?:
            date\(\'\d{4}-\d{2}-\d{2}\'\)
          |
            [\s\w]+
          |
            -?\d+
          )
          \.?\d*
        )
      \'?
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
