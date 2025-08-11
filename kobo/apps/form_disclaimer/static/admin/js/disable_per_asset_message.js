document.addEventListener('DOMContentLoaded', () => {
  const hide_default_checkbox = document.querySelector("input[id=id_hidden]")
  const languageSelector= document.querySelector("select[id=id_language]")
  const message = document.querySelector("textarea[id=id_message]")
  if(hide_default_checkbox.checked) {
    languageSelector.disabled = true
    message.disabled = true
  }
  hide_default_checkbox.addEventListener('change', () => {
    const overrideMessage = document.querySelectorAll('fieldset')[1]

    if (hide_default_checkbox.checked) {
      languageSelector.disabled = true
      message.disabled = true
    } else {
      languageSelector.disabled = false
      message.disabled = false
    }
  })
})
