describe('Login', () => {
  it('should log in to a proper user account', () => {
    const username = 'kobo';
    const pass = 'kobo';

    cy.visit('/accounts/login/?next=/');

    cy.get('#id_username').type('kobo').should('have.value', username);
    cy.get('#id_password').type('kobo').should('have.value', pass);
    cy.get('form.registration').submit();

    // check username in UI
    cy.get('.account-box .popover-menu__toggle').click();
    cy.get('.account-box .popover-menu__content.popover-menu__content--visible .account-username').should('contain', username);
  });

  it('travis-test-1', () => {
    cy.visit('http://127.0.0.1:8001/');
    cy.visit('http://127.0.0.1:8002/');
    cy.visit('http://localhost:8000/');
  });
});
