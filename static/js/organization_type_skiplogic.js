/*
  Location: /accounts/signup (and SSO equivalent)
  DOM location: After signup fields (organization type, name, website, ...)

  - Skip-logic for Organization Type dropdown
    - Show/hide organization and organization_website based on organization_type
    - Apply 'required' appearance if needed.
  - Some DOM layout improvements
  - URL validation helper for organization website field

  TODO: rename this file "signup_form_helpers.js"
  TODO: lint this file, make variable names clearer
*/
(function() {

  // ------------- DOM ARRANGEMENT --------------------------------------
  // Improve DOM source order of Django checkbox form elements
  document.querySelectorAll('form.registration input[type="checkbox"]').forEach(
    (checkbox) => {
      // Move checkbox before label; improves appearance and tabbing behavior
      checkbox.parentElement.prepend(checkbox);
      // Move 'required' asterisk into label; improves line wrapping
      const asterisk = checkbox.parentElement.querySelector('span.required');
      if (asterisk) {
        asterisk.parentElement.querySelector('label').append(asterisk);
      }
    }
  );
  // --------------------------------------------------------------------

  const organization_type = document.querySelector('    form.registration  select[name=organization_type]    ');
  const organization = document.querySelector('         form.registration   input[name=organization]         ');
  const organization_website = document.querySelector(' form.registration   input[name=organization_website] ');

  // ------------- URL VALIDATION HELP ----------------------------------
  // Make type="url" validation friendlier by auto-inserting http://
  if (organization_website) {
    // Helper to trim, and add http:// if http:// or https:// is missing
    // (1) user may paste a selected URL with leading/trailing space(s)
    // (2) user probably didn't type http://, and type="url" wants it
    const cleaned_url = (value) => {
      if (!value) {return '';}
      value = ('' + value).trim();
      if (!value.match(/.\../)) {return value;} // "dotless". don't change it
      if (!value.match(/^https?:\/?\/?.*/)) {
        value = 'http://' + value; // add missing protocol
      }
      // normalize '://' and trailing slash if the URL is valid
      try {value = new URL(value).toString();} catch (e) {/**/}
      return value;
    };
    // on tabout
    organization_website.addEventListener('blur', function(e) {
      e.target.value = cleaned_url(e.target.value);
    });
    // on "enter" key
    organization_website.addEventListener('keydown', function(e) {
      if (e.keyCode === 13) {
        e.target.value = cleaned_url(e.target.value);
      }
    });
  }
  // --------------------------------------------------------------------


  // ------------- ORGANIZATION TYPE SKIP LOGIC -------------------------
  if (!organization_type) {return;}

  // The back end uses custom validation for these fields, but on the frontend
  // they should have the same look-and-feel as regular required fields.
  document.querySelectorAll('[data-required]').forEach(function(field) {
    const redAsterisk = document.createElement('span');
    redAsterisk.classList.add('required');
    redAsterisk.textContent = '*';
    field.before(redAsterisk); // label, *, field
    field.required = true;
  });

  const organization_parent = organization?.parentElement;
  const organization_website_parent = organization_website?.parentElement;
  const organization_placeholder = document.createElement('div'); // swapper
  const organization_website_placeholder = document.createElement('div'); // swapper

  const applySkipLogic = function() {
    // Swap fields with placeholders, removing or re-adding them to the form
    if (
      organization_type.value === 'none' ||
      (organization_type.value === '' && organization_type.required)
    ) {
      if (organization_parent) {
        organization_parent.before(organization_placeholder);
        organization_parent.remove();
      }
      if (organization_website_parent) {
        organization_website_parent.before(organization_website_placeholder);
        organization_website_parent.remove();
      }
    } else {
      if (organization_parent) {
        organization_placeholder.before(organization_parent);
        organization_placeholder.remove();
      }
      if (organization_website_parent) {
        organization_website_placeholder?.before(organization_website_parent);
        organization_website_placeholder?.remove();
      }
    }
  };

  organization_type.addEventListener('change', applySkipLogic);
  applySkipLogic();
  // --------------------------------------------------------------------
})();
