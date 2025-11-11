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

  # TODO: WIP
  # Future: if we need a generic "optional number" parameter,
  #         we can reuse some of this.
                        # str     number?       number?
  # https://chat.kobotoolbox.org/user_uploads/2/e4/-RDgXkU0dpJ-2unJPBLnwMkf/Screenshot_20250824-141819_KoboCollect.jpg
  maxPixelsParam = (label, currentValue, defaultValue) ->

    # IDEA #1
    #
    # Maximum pixels of the long edge of the image
    # ( ) Very small (640px)
    # (*) Small (1024px) (default)
    # ( ) Medium (2048px)
    # ( ) Large (3072px)
    # ( ) Custom **max-pixels:** [_____|] px
    # ( ) Original size (no limit)
    #

    # IDEA #2: Textbox with hints
    #    max-pixels: [ 1024 ] px
    #    Leave blank for no limit

    # IDEA #3: Slider
    # Maximum pixels of the long edge of the image
    # ( ) Typical: --||---|--|---|--- No limit
    # ( ) Custom: [    ]px
    #


    # State: currentValue, which is any number
    #        Let's normalize it: anything > 1 is reasonable,
    #                            anything falsy, including blank string, is

    # View: If the custom max-pixels option is selected but unset,
    #    let's show the default value as placeholder.
    #    Let's make the number range go from 1 to something big (no limit)
    #  Let's render "Default: X px if the default isn't in the list.

    hints = [
      _.escape t('Leave empty for no limit.')
      _.escape t('Default: ##').replace('##',
          if defaultValue > 0 then "#{defaultValue}px"
          else t('No limit'))
      _.escape t('No limit')
    ]

    # TODO: convert to existing class if necessary
    style = "style='" + ("""
      margin-top:  0.2em;
      font-size:   smaller;
      font-weight: normal;
      opacity:     0.7;
      line-height: 1.3;
    """.split('\n').join('').replace(/\s/g, '')) + "'"

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
          placeholder='#{hints[2]}'
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
