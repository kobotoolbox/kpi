# Running tests

## How to start the test server

If you normally run kpi with `./manage.py runserver 0.0.0.0:8000`, you can use:

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
root@kpi:/srv/src/kpi# DJANGO_SETTINGS_MODULE=kobo.settings.testing ./manage.py cypress_testserver --addrport 0.0.0.0:8000 --noinput                                     
```

<details><summary>About cypress_testserver</summary>

#### About cypress_testserver

The **cypress_testserver** provides fixtures for the Cypress tests.

```
DJANGO_SETTINGS_MODULE=kobo.settings.testing (1) Use test server settings
              ./manage.py cypress_testserver (2) Run the test server
                     --addrport 0.0.0.0:8000 (3) Bind :8000 (check this)
                     --noinput               (4) Skip 'delete database' prompt
```

1. `DJANGO_SETTINGS_MODULE=kobo.settings.testing` switches the server away from using your default kpi database. Source: [kpi/kobo/settings/testing.py](https://github.com/kobotoolbox/kpi/blob/ae07326dec1984feb783cca5e91741c71a93fa9c/kobo/settings/testing.py) 
2. `./manage.py cypress_testserver`  is a custom management command. Starts a test server with fixtures created in Python specifically for Cypress tests.
    - [kpi/management/commands/cypress_testserver.py](https://github.com/kobotoolbox/kpi/commit/314314d82b4cc090944ffcc1379d4a566afbcf07) - Add or change fixtures here.
    - [django-admin/#testserver](https://docs.djangoproject.com/en/4.0/ref/django-admin/#testserver) - Django's built-in `testserver`, which this is based on.
3. `--addrport 0.0.0.0:8000` - Change this if necessary. Use port 80 if you're running on http://kf.kobo.local, port 8000 if you're using kobo-install.
4. `--noinput` - Skips console prompts about clearing the existing test database.
</details>

Between subsequent Cypress test runs, you'll need to restart the test server to reset the fixture states. Interrupt it with `^C`, then re-run the above command to start the server again.

## How to run Cypress tests

<details>
<summary>Prerequisite: Install Cypress</summary>

### Installing Cypress

1. Navigate to the `cypress` folder. 
2. Install cypress with `npm install`. 

Cypress will likely ask you to install [some OS dependencies](https://on.cypress.io/required-dependencies) (about .5 GB) when you try to run a test.
</details>

(Make sure `$KOBOFORM_URL` or `$CYPRESS_BASE_URL` points to your test server.)

### Command line only tests

    kpi/cypress$ npx cypress run

### Cypress UI

    kpi/cypress$ npx cypress open

### Useful configuration options

> 🚧  *We are on an older version of cypress (8.7.0), so our configuration guide is located at [Legacy Configuration](https://docs.cypress.io/guides/references/legacy-configuration).*

Both commands (cypress run, cypress open) accept a comma-separated list of config values with the `--config` flag.

#### How to disable video/screenshot recording

If you're on a computer with limited resources, you may wish to use these:

```
  video=false                     Disable video recording of Cypress tests
  screenshotOnRunFailure=false    Disable screenshots of Cypress tests
```

For example, to run the command-line only tests without the above options, use `npx cypress run --config video=false,screenshotOnRunFailure=false`. 

Alternatively, you could set the environment variables `CYPRESS_VIDEO` and `CYPRESS_SCREENSHOT_ON_RUN_FAILURE`.

#### How to override the baseUrl

We have configured Cypress to read its baseUrl from `KOBOFORM_URL` because it's likely you'll already have that set from kpi or kobo-install.

You can override this with `CYPRESS_BASE_URL`, or any other method of configuration.


# Writing tests

## Structure/Folders

- fixtures: basic parameters can be changed from the cypress/fixtures folder.
- integration: tests will go here.
- support: custom commands and code that is run before all tests. This is where cypress is told to keep the session open for all tests by remembering cookies.
- cypress.json: order in which tests are carried out

## Cypress Philosophy

- All tests should be independent.
- Elements should be selected with an attribute that is not expected to change.
- Conditional testing is strongly discouraged.
- Avoid using cy.wait or timeout as this will slow things down considerably.
