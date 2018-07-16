// login user half-programmaticaly
Cypress.Commands.add('login', (username = 'kobo', password = 'kobo') => {
  // we need to visit "/" to get csrftoken cookie
  // TODO: try getting cookie value without the need to load page
  cy.visit('/');

  cy.getCookie('csrftoken').then((cookie) => {
    cy.request({
      method: 'POST',
      url: '/accounts/login/',
      form: true,
      body: {
        username: username,
        password: password,
        csrfmiddlewaretoken: cookie.value
      }
    });
  });
});
