## How to start the test server

see https://github.com/kobotoolbox/kpi/commit/314314d82b4cc090944ffcc1379d4a566afbcf07

    kobo-install$ ./run.py -cf exec kpi bash
    root@kpi:/srv/src/kpi# sv stop uwsgi
    ok: down: uwsgi: 0s, normally up
    root@kpi:/srv/src/kpi# DJANGO_SETTINGS_MODULE=kobo.settings.testing ./manage.py cypress_testserver --addrport 0.0.0.0:8000 --noinput

## How to run a test

### Command line only tests

    kpi/cypress$ npx cypress run

### Cypress UI

    kpi/cypress$ npx cypress open


## Structure/Folders:

- fixtures: basic parameters can be changed from the cypress/fixtures folder.  
- integration: tests will go here.  
- support: custom commands and code that is run before all tests. This is where cypress is told to keep the session open for all tests by remembering cookies.  
- cypress.json: order in which tests are carried out

## Cypress Philosophy:

- All tests should be independent.
- Elements should be selected with an attribute that is not expected to change.
- Conditional testing is strongly discouraged.
- Avoid using cy.wait or timeout as this will slow things down considerably.
