document.addEventListener('DOMContentLoaded', () => {
  const hide_default_checkbox = document.querySelector('input[id=id_hidden]')
  const overrideFieldset = document.querySelectorAll('fieldset')[1]
  if (hide_default_checkbox.checked) {
    overrideFieldset.classList.add('hidden')
  }
  hide_default_checkbox.addEventListener('change', () => {
    if (hide_default_checkbox.checked) {
      overrideFieldset.classList.add('hidden')
    } else {
      overrideFieldset.classList.remove('hidden')
    }
  })
})
