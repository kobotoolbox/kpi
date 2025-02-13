// Submit language form when the language dropdown changes
document.querySelector('select[name="language"]').onchange = function () {
  this.form.submit();
};
