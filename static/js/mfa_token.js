const currentSectionAttr = 'data-mfa-token-form-current-section';
const toggleAttr = 'data-mfa-token-form-toggle';
const currentSectionEl = document.querySelector(`[${currentSectionAttr}]`);
const toggles = document.querySelectorAll(`[${toggleAttr}]`);
toggles.forEach((toggle) => {
  toggle.addEventListener('click', (evt) => {
    evt.preventDefault();
    const targetSection = evt.target.getAttribute(toggleAttr);
    currentSectionEl.setAttribute(currentSectionAttr, targetSection);
  });
});
