/*
  Location: /accounts/signup (and SSO equivalent)
  DOM location: After signup fields (organization type, name, ...)

  - Show/hide organization and organization_website based on organization_type
  - Apply 'required' appearance if needed.
*/
(function() {
  const organization_type    = document.querySelector('form.registration  select[name=organization_type]')
  const organization         = document.querySelector('form.registration   input[name=organization]')
  const organization_website = document.querySelector('form.registration   input[name=organization_website]')
  // TODO: Make type="url" validation friendlier by auto-inserting http://
  //       Use a custom validator to ensure the domain has at least one `.`

  if (!organization_type) {return}

  document.querySelectorAll('[data-required]').forEach(function(field) {
    // On the frontend, treat these fields like regular required fields.
    const redAsterisk = document.createElement('span')
    redAsterisk.classList.add('required')
    redAsterisk.textContent = '*'
    field.before(redAsterisk) // label, *, field
    field.required = true
  })

  const organization_parent = organization?.parentElement
  const organization_website_parent = organization_website?.parentElement
  const organization_placeholder = document.createElement('div')
  const organization_website_placeholder = document.createElement('div')

  const applySkipLogic = function() {
    // Swap fields with placeholders, removing or re-adding them to the form
    if (
      organization_type.value === 'none' ||
      (organization_type.value === '' && organization_type.required)
    ) {
      if (organization_parent) {
        organization_parent.before(organization_placeholder)
        organization_parent.remove()
      }
      if (organization_website_parent) {
        organization_website_parent.before(organization_website_placeholder)
        organization_website_parent.remove()
      }
    } else {
      if (organization_parent) {
        organization_placeholder.before(organization_parent)
        organization_placeholder.remove()
      }
      if (organization_website_parent) {
        organization_website_placeholder?.before(organization_website_parent)
        organization_website_placeholder?.remove()
      }
    }
  }

  organization_type.addEventListener('change', applySkipLogic)
  applySkipLogic()

  /*
    Improve DOM source order of Django checkbox form elements
  */
  document.querySelectorAll('form.registration input[type="checkbox"]').forEach(
    (checkbox) => {
      // Move checkbox before label
      checkbox.parentElement.prepend(checkbox)
      // Move 'required' asterisk into label
      asterisk = checkbox.parentElement.querySelector('span.required')
      if (asterisk) {
        asterisk.parentElement.querySelector('label').append(asterisk)
      }
    }
  )
})()
