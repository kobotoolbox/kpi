// login user programmaticaly
Cypress.Commands.add('login', (username = 'kobo', password = 'kobo') => {
  cy.request({
    method: 'GET',
    url: '/accounts/login/'
  }).then((data) => {
    const tokenName = 'csrftoken=';
    let tokenVal;
    for (let cookieVal of data.headers['set-cookie']) {
      if (cookieVal.startsWith(tokenName)) {
        tokenVal = cookieVal.substring(tokenName.length, cookieVal.indexOf(';'));
      }
    }
    cy.request({
      method: 'POST',
      url: '/accounts/login/',
      form: true,
      body: {
        username: username,
        password: password,
        csrfmiddlewaretoken: tokenVal
      }
    });
  });
});
