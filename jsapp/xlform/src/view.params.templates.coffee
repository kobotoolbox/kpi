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

    # Render something like this:
    #
    # Maximum pixels of the long edge of the image
    # ( ) Very small (640px)
    # (*) Small (1024px) (default)
    # ( ) Medium (2048px)
    # ( ) Large (3072px)
    # ( ) Custom **max-pixels:** [_____|] px
    # ( ) Original size (no limit)

    # State: currentValue, which is any number
    #        Let's normalize it: anything > 1 is reasonable,
    #                            anything falsy, including blank string, is

    # View: If the custom max-pixels option is selected but unset,
    #    let's show the default value as placeholder.
    #    Let's make the number range go from 1 to something big (no limit)
    #  Let's render "Default: X px if the default isn't in the list.

    # TODO:
    #  - ( ) Rendering
    #  - ( ) Interactivity


    # Edge cases to consider

    currentValueAttr = '' # number or undefined
    defaultValueAttr = '' # number or undefined

    placeholder = if !defaultValue? then 'unset'

    return """
      <label class='text-box'>
        <span class='text-box__label'>#{label}</span>

        <input class='text-box__input' type='number' #{valueAttr} #{defaultValueAttr}/>
      </label>
      """
    # if typeof defaultValue isnt 'undefined'
    #   defaultValueAttr = "placeholder='#{defaultValue}'"
    #
    # if currentValue isnt ''
    #   valueAttr = "value='#{currentValue}'"
    # else if typeof defaultValue isnt 'undefined'
    #   valueAttr = "value='#{defaultValue}'"




  return {
    booleanParam:   booleanParam
    numberParam:    numberParam
    maxPixelsParam: maxPixelsParam
  }
