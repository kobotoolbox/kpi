module.exports = do ->
  _t = require('utils').t

  numberParam = (label, number) ->
    """
    <label class='text-box'>
      <span class='text-box__label'>#{label}</span>
      <input class='text-box__input' type='number' value='#{number}'/>
    </label>
    """

  booleanParam = (label, isChecked) ->
    if isChecked is 'true'
      checkedAttr = 'checked'

    """
    <div class='checkbox'>
      <label class='checkbox__wrapper'>
        <input class='checkbox__input' type='checkbox' #{checkedAttr}/>
        <span class='checkbox__label'>#{label}</span>
      </label>
    </div>
    """

  booleanParam: booleanParam
  numberParam: numberParam
