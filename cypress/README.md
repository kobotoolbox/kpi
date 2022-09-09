## How to start the test server

If you normally run kpi with `./manage.py runserver 0.0.0.0:8000`, you'll use:

```
kpi$ DJANGO_SETTINGS_MODULE=kobo.settings.testing  \
     ./manage.py cypress_testserver                \
       --addrport 0.0.0.0:8000                     \
       --noinput
```

If you're using kobo-docker / kobo-install, the process will look like this:

```console
kobo-install$  ./run.py -cf exec kpi bash
root@kpi:/srv/src/kpi#  sv stop uwsgi
ok: down: uwsgi: 0s, normally up
root@kpi:/srv/src/kpi#  DJANGO_SETTINGS_MODULE=kobo.settings.testing  \
                        ./manage.py cypress_testserver                \
                        --addrport 0.0.0.0:8000                       \
                        --noinput                                     
```

#### About `cypress_testserver`

- The Cypress tests are written to expect certain fixtures (specific data: users and projects) in kpi's database.
- The command `./manage.py cypress_testserver` is like [the Django-Admin `testserver`](https://docs.djangoproject.com/en/4.0/ref/django-admin/#testserver), but [we customize it](https://github.com/kobotoolbox/kpi/commit/314314d82b4cc090944ffcc1379d4a566afbcf07) to load fixtures specifically for these Cypress tests.
- The environment variable `DJANGO_SETTINGS_MODULE=kobo.settings.testing` switches the server away from using your default kpi database. For more info about what else this does, see [kpi/kobo/settings/testing.py](https://github.com/kobotoolbox/kpi/blob/ae07326dec1984feb783cca5e91741c71a93fa9c/kobo/settings/testing.py).
- The flag `--noinput` surpresses console warnings about clearing the existing test database.
- During each test run, the Cypress tests modify the database fixtures. When you're running Cypress repeatedly, you need to restart the test server to reset the fixture states. `^C` to interrupt, then run the above command again.


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
