# Contributing to KPI

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## We Develop with Github

We use Github to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html), So All Code Changes Happen Through Pull Requests

Pull requests are the best way to propose changes to the codebase (we use [Github Flow](https://guides.github.com/introduction/flow/index.html)). We actively welcome your pull requests:

1. Fork the repo and create your branch from `master`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the GNU Affero General Public License

In short, when you submit code changes, your submissions are understood to be under the same [GNU Affero General Public License](./LICENSE) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](https://github.com/kobotoolbox/kpi/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/kobotoolbox/kpi/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People *love* thorough bug reports. I'm not even kidding.

## Use a Consistent Coding Style

For more details please check our linter configurations and `.editorconfig` files.

## Development workflow

Basic workflow (for frontend):

1.  kobo-docker `docker-compose up`
2.  kobo-docker `docker-compose build kpi`
3.  kpi `npm run watch`
4.  open `http://<your IP>:8000`

Restarting:

1.  kobo-docker `docker-compose stop`
2.  kobo-docker `docker-compose up -d`

## Managing

Go to `http://<your IP>:8000/admin`.

## Debugging

Killing (stopping) all docker containers: `docker kill $(docker ps -q)`. Useful when you ungracefully close project while working.

Displaying logs: kobo-docker `docker-compose logs kpi`

## Finding your IP

On MacOS:

```
ifconfig | grep "inet " | grep -Fv 127.0.0.1 | awk '{print $2}'
```

## Preparing files

`./kobo-docker/envfile.local.txt` - fill up those lines:

```
11 HOST_ADDRESS=<your IP>
…
13 ENKETO_API_TOKEN=<random string>
…
17 DJANGO_SECRET_KEY=<random string>
…
19 KOBO_SUPERUSER_USERNAME=kobo
…
21 KOBO_SUPERUSER_PASSWORD=kobo
```

duplicate `./kobo-docker/docker-compose.local.yml` as `docker-compose.yml` and comment/uncomment out some lines:

```
81 # image: kobotoolbox/kpi:latest
…
83 build: ../kpi
…
108 - ../kpi:/srv/src/kpi
…
111 # - ./.vols/kobocat_media_uploads:/srv/src/kobocat/media
```

`./kpi/Dockerfile` - comment out (pay attention to `&& \` on preceding lines):

```
71 ln -s "${WEBPACK_STATS_PATH}" webpack-stats.json
…
73 RUN npm run copy && npm run build
…
87 ln -s "${WEBPACK_STATS_PATH}" webpack-stats.json
```

`./kpi/docker/init.bash` - comment out all lines:

```
22 if [[ ! -L "${KPI_SRC_DIR}/node_modules" ]] || [[ ! -d "${KPI_SRC_DIR}/node_modules" ]]; then
…
46 rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"
```
