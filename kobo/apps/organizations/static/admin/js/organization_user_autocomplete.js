/*
 * Enforce autocomplete for organization users to limit the list to the current
 * organization only.
 * */
document.addEventListener('DOMContentLoaded', () => {
  const orgLink = document.querySelector('.field-organization .readonly a')

  if (orgLink) {
    const orgUrl = new URL(orgLink.href, window.location.origin)
    const pathParts = orgUrl.pathname.split('/')
    const orgId = pathParts[pathParts.length - 3]
    const userField = document.querySelector('#id_organization_user')

    if (userField) {
      const baseUrl = userField.dataset['ajax-Url']
      const newUrl = new URL(baseUrl, window.location.origin)
      newUrl.searchParams.set('organization_id', orgId)
      userField.dataset['ajax-Url'] = newUrl.toString()
    }
  }
})
