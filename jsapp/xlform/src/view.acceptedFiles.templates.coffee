module.exports = do ->

  acceptedFilesInput = (value, placeholder) ->
    return """
    <div class='card__settings__fields__field'>
      <label>#{t("Accepted files")}</label>
      <span class='settings__input'>
        <input class='text' type='text' value='#{value}' placeholder='#{placeholder}'/>
      </span>
    </div>
    """

  acceptedFilesInput: acceptedFilesInput
