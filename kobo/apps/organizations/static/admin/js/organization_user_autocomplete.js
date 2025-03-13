document.addEventListener('DOMContentLoaded', function () {
  const orgLink = document.querySelector('.field-organization .readonly a');

  if (orgLink) {
    const orgUrl = new URL(orgLink.href, window.location.origin);
    const pathParts = orgUrl.pathname.split('/');
    const orgId = pathParts[pathParts.length - 3];
    const userField = document.querySelector('#id_organization_user');

    if (userField) {
      userField.addEventListener('focus', function () {
        const baseUrl = userField.dataset.autocompleteUrl;
        const newUrl = new URL(baseUrl, window.location.origin);
        newUrl.searchParams.set('organization_id', orgId);

        userField.dataset.autocompleteUrl = newUrl.toString();
      });
    }
  }
});
