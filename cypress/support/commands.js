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

// flush database
Cypress.Commands.add('flushDatabase', () => {
  console.warn('Flushing database not implemented yet');
  // cy.exec('./manage.py flush --help');
});

Cypress.Commands.add('createAsset', (assetName) => {
  cy.getCookie('csrftoken').then((cookie) => {
    cy.request({
      method: 'POST',
      url: '/assets/',
      form: true,
      body: {
        name: assetName,
        settings: {
          description: '',
          sector: '',
          country: '',
          'share-metadata': true
        },
        asset_type: 'survey',
        csrfmiddlewaretoken: cookie.value
      }
    });
  });
});
