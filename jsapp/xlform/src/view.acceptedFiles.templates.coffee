module.exports = do ->
  _t = require('utils').t

  acceptedFilesInput = (value) ->
    return """
    <label class='text-box'>
      <span class='text-box__label'>#{_t('Accepted files')}</span>
      <input class='text-box__input' type='text' value='#{value}'/>
    </label>
    """

  acceptedFilesInput: acceptedFilesInput
