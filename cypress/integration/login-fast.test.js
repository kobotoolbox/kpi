describe('Login programmaticaly', () => {
  it('should log in to a proper user account without need for UI', () => {
    const username = 'kobo';
    const pass = 'kobo';

    cy.visit('/');

    cy.getCookie('csrftoken').then((cookie) => {
      cy.request({
        method: 'POST',
        url: '/accounts/login/',
        form: true,
        body: {
          username: username,
          password: pass,
          csrfmiddlewaretoken: cookie.value
        }
      });
      cy.visit('/');
      cy.getCookie('kobonaut').should('exist');

      // check username in UI
      cy.get('.account-box .popover-menu__toggle').click();
      cy.get('.account-box .popover-menu__content.popover-menu__content--visible .account-username').should('contain', username);
    });
  });
});
