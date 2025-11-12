_ = require('underscore')

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

  maxPixelsParam = (label, currentValue, defaultValue) ->
    # Render as a textbox with hints
    #    max-pixels: [ 2048 ] px
    #    Leave empty for no limit
    #    Default value: 2048px

    hints = [
      _.escape t('Leave empty for no limit.')
      _.escape t('Default: ##').replace('##',
        if defaultValue > 0 then "#{defaultValue}px"
        else t('No limit'))
    ]

    style = "style='" + ("""
      margin-top:  0.2em;
      font-size:   smaller;
      font-weight: normal;
      opacity:     0.7;
      line-height: 1.3;
    """.replace(/\s/g, '')) + "'"

    # List of suggestions if the field is blank
    suggest_list_id = 'suggest-max-pixels'
    suggestions_list = """
    <datalist id="#{suggest_list_id}">
      <option value=" " label="#{_.escape t('No limit')}" />
      <option value="640"  />
      <option value="1024" />
      <option value="2048" />
      <option value="3072" />
    </datalist>
    """

    return """
      <label class='text-box'>
        <span class='text-box__label'>#{_.escape label}</span>
        <input
          class='text-box__input'
          value='#{_.escape currentValue}'
          inputmode='numeric'
          pattern='\\d{0,5}'
          placeholder='#{_.escape t('No limit')}'
          list=#{suggest_list_id}
        /><span style='font-weight:normal'> px</span>
        <p #{style}>#{hints[0]}<br>#{hints[1]}</p>
        #{suggestions_list}
      </label>
      """

  return {
    booleanParam:   booleanParam
    numberParam:    numberParam
    maxPixelsParam: maxPixelsParam
  }
