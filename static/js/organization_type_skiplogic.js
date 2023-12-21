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
})()
