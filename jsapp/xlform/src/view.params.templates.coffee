module.exports = do ->
  numberParam = (label, currentValue, defaultValue) ->
    if typeof defaultValue isnt 'undefined'
      defaultValueAttr = "placeholder='#{defaultValue}'"

    if currentValue isnt ''
      valueAttr = "value='#{currentValue}'"
    else if typeof defaultValue isnt 'undefined'
      valueAttr = "value='#{defaultValue}'"

    template = """
    <label class='text-box'>
      <span class='text-box__label'>#{label}</span>
      <input class='text-box__input' type='number' #{valueAttr} #{defaultValueAttr}/>
    </label>
    """
    return template

  booleanParam = (label, isChecked) ->
    if isChecked is 'true'
      checkedAttr = 'checked'

    template = """
    <div class='checkbox'>
      <label class='checkbox__wrapper'>
        <input class='checkbox__input' type='checkbox' #{checkedAttr}/>
        <span class='checkbox__label'>#{label}</span>
      </label>
    </div>
    """
    return template

  return {
    booleanParam: booleanParam
    numberParam: numberParam
  }
