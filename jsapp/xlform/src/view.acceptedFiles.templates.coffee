module.exports = do ->

  acceptedFilesInput = (value, placeholder) ->
    template = """
    <div class='card__settings__fields__field'>
      <label>#{t("Accepted files")}</label>
      <span class='settings__input'>
        <input class='text' type='text' value='#{value}' placeholder='#{placeholder}'/>
      </span>
    </div>
    """
    
    return template

  return acceptedFilesInput: acceptedFilesInput

