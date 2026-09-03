// Hide the in-app message textarea while the "Send in-app message" toggle
// is unchecked on the managed SSO confirmation page.
document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('id_send_in_app_message')
  const field = document.getElementById('in-app-message-field')
  if (!checkbox || !field) {
    return
  }
  const toggle = () => {
    field.hidden = !checkbox.checked
  }
  checkbox.addEventListener('change', toggle)
  toggle()
})
