describe('Login programmaticaly', () => {
  it('should log in to a proper user account without need for UI', () => {
    cy.flushDatabase();
    cy.login();

    cy.visit('/');
    cy.getCookie('kobonaut').should('exist');

    // check username in UI
    cy.get('.account-box .popover-menu__toggle').click();
    cy.get('.account-box .popover-menu__content.popover-menu__content--visible .account-username').should('contain', 'kobo');
  });
});
