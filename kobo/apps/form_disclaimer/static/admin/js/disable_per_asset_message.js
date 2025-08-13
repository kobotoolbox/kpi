document.addEventListener('DOMContentLoaded', () => {
  const hide_default_checkbox = document.querySelector('input[id=id_hidden]')
  const languageSelector= document.querySelector('select[id=id_language]')
  const message = document.querySelector('textarea[id=id_message]')
  const overrideFieldset = document.querySelectorAll('fieldset')[1]
  if(hide_default_checkbox.checked) {
    languageSelector.disabled = true
    message.disabled = true
    overrideFieldset.classList.add('hidden')
  }
  hide_default_checkbox.addEventListener('change', () => {
    if (hide_default_checkbox.checked) {
      languageSelector.disabled = true
      message.disabled = true
      overrideFieldset.classList.add('hidden')
    } else {
      languageSelector.disabled = false
      message.disabled = false
      overrideFieldset.classList.remove('hidden')
    }
  })
})
