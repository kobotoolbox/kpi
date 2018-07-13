describe('Login', () => {
  it('should log in to a proper user account', () => {
    const username = 'kobo';
    const pass = 'kobo';

    cy.visit('/');

    cy.get('#id_username').type('kobo').should('have.value', username);
    cy.get('#id_password').type('kobo').should('have.value', pass);
    cy.get('form.registration').submit();

    // check username in UI
    cy.get('.account-box .popover-menu__toggle').click();
    cy.get('.account-box .popover-menu__content.popover-menu__content--visible .account-username').should('contain', username);
  });
});
