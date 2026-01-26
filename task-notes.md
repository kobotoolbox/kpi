

WIP scratchpad for this PR.
Not intended for merge to main.

-------------------------------

###

Stuff to do if you're testing this.

- Build the image. Go in and see if the file permissions are what you expected.
   - Anything amiss? anything risky? CC john, scott, olivier

If you're testing the claims made: compare image sizes, compare times. Try using it for local tasks
and see if typical rebuilds are faster for your use case.


### Wed 1/28

Wondering if there's anything owned by root that really ought
to be owned by something else instead

### Test 1

- Upgrade a pip package, then rebuild.

```sh
$ ./pip-compile.sh -P regex 
# regex==2023.12.25 -> regex==2026.1.15

$ ../kobo-install/run.py -cf build kpi
# 20.1 seconds for uv pip sync, 0.1 seconds for grabbing the unchanged webpack build
```

```diff
! (for brevity, i'm omitting all steps that took 0.0s)
! the cool thing here is with requirements changed but the 

   [+] Building 36.1s (36/36) FINISHED                                                                                
   => [internal] load metadata for ghcr.io/astral-sh/uv:python3.10-bookworm-slim                                 0.3s
   => [internal] load metadata for ghcr.io/astral-sh/uv:python3.10-bookworm                                      0.3s
   => [internal] load metadata for docker.io/library/node:20.19-bookworm-slim                                    0.3s
   => [internal] load build context                                                                              0.4s
   => => transferring context: 833.47kB                                                                          0.3s
   => [pip-dependencies 3/4] COPY ./dependencies/pip/requirements.txt /srv/tmp/pip_dependencies.txt              0.1s
   => [kpi-django-app  7/14] COPY . /srv/src/kpi                                                                 0.6s
+  => [pip-dependencies 4/4] RUN uv pip sync "/srv/tmp/pip_dependencies.txt" 1>/dev/null                        20.1s
!  => [kpi-django-app  8/14] COPY --from=pip-dependencies /opt/venv /opt/venv                                    1.5s 
+  => [kpi-django-app  9/14] COPY --from=webpack-build-prod --parents     /srv/src/kpi/./jsapp/compiled/         0.1s 
!  => [kpi-django-app 10/14] RUN python manage.py collectstatic --noinput                                        5.6s 
   => [kpi-django-app 11/14] RUN git submodule init &&     git submodule update --remote &&     python manage.p  2.2s 
   => [kpi-django-app 12/14] RUN mkdir -p     "/srv/logs/"     "/srv/src/kpi/emails"                             0.2s 
   => [kpi-django-app 13/14] RUN echo "export PATH=/opt/venv/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:  0.2s 
   => [kpi-django-app 14/14] RUN chown -R "kobo:kobo" /srv/src/kpi/emails/ &&     chown -R "kobo:kobo" /srv/log  0.3s 
!  => exporting to image                                                                                         3.8s 
!  => => exporting layers                                                                                        3.7s 
   [+] build 1/1
   ✔ Image kpi:dev.node-build-kobofe1769438801 Built                                                            36.2s
```

#### No-cache

```diff
   ❯ task build -- kpi --no-cache
+   task: [build] kobo-install/run.py -cf build kpi --no-cache
+   [+] Building 132.4s (36/36) FINISHED                                                                                                                        
   => [internal] load local bake definitions                                                                                                             0.0s
   => => reading from stdin 562B                                                                                                                         0.0s
   => [internal] load build definition from Dockerfile                                                                                                   0.0s
   => => transferring dockerfile: 8.82kB                                                                                                                 0.0s
   => [internal] load metadata for ghcr.io/astral-sh/uv:python3.10-bookworm-slim                                                                         0.3s
   => [internal] load metadata for ghcr.io/astral-sh/uv:python3.10-bookworm                                                                              0.3s
   => [internal] load metadata for docker.io/library/node:20.19-bookworm-slim                                                                            0.3s
   => [internal] load .dockerignore                                                                                                                      0.0s
   => => transferring context: 295B                                                                                                                      0.0s
   => CACHED [kpi-django-app  1/14] FROM ghcr.io/astral-sh/uv:python3.10-bookworm-slim@sha256:43796ca146882a77c3b678dae750df0ff6452a3f1298902b191ab9ddb  0.0s
   => CACHED [pip-dependencies 1/4] FROM ghcr.io/astral-sh/uv:python3.10-bookworm@sha256:6ea11e9ad4fdff5576080572b7ac0408abfc7536111d16b8438a44ad7c9be3  0.0s
   => [npm-install 1/6] FROM docker.io/library/node:20.19-bookworm-slim@sha256:b342de02eb4a57cd6986290a69833d20818508db8078dba0197a024193410aee          0.0s
   => [internal] load build context                                                                                                                      0.4s
   => => transferring context: 1.34MB                                                                                                                    0.3s
   => CACHED [npm-install 2/6] WORKDIR /srv/src/kpi                                                                                                      0.0s
   => [npm-install 3/6] RUN chown node:node .                                                                                                            0.3s
+  => [kpi-django-app  2/14] RUN apt-get -qq update &&     apt-get -qq -y install curl &&     curl -fsSL https://deb.nodesource.com/setup_20.x | bash  110.8s
   => [pip-dependencies 2/4] RUN python -m venv "/opt/venv"                                                                                              3.2s
   => [npm-install 4/6] COPY --chown=node:node --parents     jsapp/k-icons-css-template.hbs     jsapp/svg-icons/     .                                   0.1s
   => [npm-install 5/6] COPY --chown=node:node --parents     patches/                      scripts/copy_fonts.sh         scripts/generate_icons.js       0.3s
+  => [npm-install 6/6] RUN npm clean-install     && npm cache clean --force                                                                            36.8s
   => [pip-dependencies 3/4] COPY ./dependencies/pip/requirements.txt /srv/tmp/pip_dependencies.txt                                                      0.0s
+  => [pip-dependencies 4/4] RUN uv pip sync "/srv/tmp/pip_dependencies.txt" 1>/dev/null                                                                56.0s
+  => [webpack-build-prod 4/6] COPY --from=npm-install --parents     /srv/src/kpi/./jsapp/fonts/       /srv/src/kpi/./msw-mocks/         /srv/src/kpi/.  7.8s
   => [webpack-build-prod 5/6] COPY --chown=node:node --parents     jsapp/img/          jsapp/js/           jsapp/scss/         jsapp/xlform/       jsa  0.9s
+  => [webpack-build-prod 6/6] RUN --mount=from=npm-install,source=/srv/src/kpi/node_modules,target=/srv/src/kpi/node_modules     SKIP_TS_CHECK=true    19.3s
   => [kpi-django-app  3/14] RUN echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen &&     locale-gen && dpkg-reconfigure locales -f noninteractive              2.6s 
   => [kpi-django-app  4/14] WORKDIR /srv/src/kpi/                                                                                                       0.0s 
   => [kpi-django-app  5/14] RUN adduser --disabled-password --gecos '' "kobo"                                                                           0.3s 
+  => [kpi-django-app  6/14] RUN mkdir -p "/srv/tmp/.npm" &&     npm config set cache "/srv/tmp/.npm" --global &&     npm install -g check-dependencies  4.2s 
   => [kpi-django-app  7/14] COPY . /srv/src/kpi                                                                                                         0.6s 
   => [kpi-django-app  8/14] COPY --from=pip-dependencies /opt/venv /opt/venv                                                                            1.6s 
   => [kpi-django-app  9/14] COPY --from=webpack-build-prod --parents     /srv/src/kpi/./jsapp/compiled/         /srv/src/kpi/./webpack-stats.json       0.1s 
+  => [kpi-django-app 10/14] RUN python manage.py collectstatic --noinput                                                                                5.6s 
   => [kpi-django-app 11/14] RUN git submodule init &&     git submodule update --remote &&     python manage.py compilemessages                         2.2s 
   => [kpi-django-app 12/14] RUN mkdir -p     "/srv/logs/"     "/srv/src/kpi/emails"                                                                     0.2s 
   => [kpi-django-app 13/14] RUN echo "export PATH=/opt/venv/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> /etc/p  0.2s 
   => [kpi-django-app 14/14] RUN chown -R "kobo:kobo" /srv/src/kpi/emails/ &&     chown -R "kobo:kobo" /srv/logs &&     chown -R "kobo:kobo" /srv/tmp &  0.3s 
   => exporting to image                                                                                                                                 3.1s 
   => => exporting layers                                                                                                                                3.1s 
   => => writing image sha256:0b5b9589f594fc9d49bf7cf0293a2539806a1b6d4437a4c2a129975ac0ec729b                                                           0.0s 
   => => naming to docker.io/library/kpi:dev.node-build-kobofe1769438801                                                                                 0.0s
   => resolving provenance for metadata file                                                                                                             0.0s
   [+] build 1/1
+  ✔ Image kpi:dev.node-build-kobofe1769438801 Built                                                                                                   132.4s
```



#### Notes from 'dive'

Does the production image need to have the `.git` directory? It's 146 MB. (With it, kpi/ is 195 MB, without it, kpi/ is 49 MB.)
We use the .git directory for 2 things in production that I know of:

1. Showing git tags or commit hashes
2. Downloading the translation submodule (and updating it)

Git hashes (1) can be done at build time with a bind mount (use RUN --mount… instead of copying the .git folder in, then write the info you need in a single step.)
Translations (2) could be pulled in a regular script instead of using a submodule. That would be cool.

Other stuff:

- **428 MB**: Our /opt/venv. Not much we can do about that.
   - 78 MB googleapiclient. most sizeable JSONs are for APIs we don't use.
   - 41 MB, pandas.
- **1.2 GB**: Our apt packages. 
   - 603 MB lib/x86_64-linux…
      - 117 MB …libLLVM
      - 31 MB  …libicudata
   - 192 MB lib/jvm
   - 146 MB bin/
      - 98 MB node
   - Long tail

Whatevs! 


### Tues 1/27


What's here so far:

1. A build stage that produces node_modules and jsapp/fonts.
2. A build stage that produces jsapp/compiled and webpack-stats.json.

What's still TODO:

1. Adapt the main Dockerfile, so that the Python prod image can
   benefit from the improved Node build stage.

What I like:

1. careful file ownership -> fewer problems down the line
2. more layers -> faster rebuilds in dev


<!---

1. I took a careful approach to file ownership / permissions, using non-root user 1000. Permission problems caused by root ownership tend to be disruptive when they appear downstream, so I think this will be an improvement overall.
2. I've thought carefully about layers and caching. Haven't measured it yet, but during a normal workday, I suspect the median kpi image dev build could be 10-40 seconds faster than before.

-->


Notes for reviewer:

There might be a leftover `taskfile.yml` in the PR at review time. Before merging to main, I'll delete it. Until then, maybe it's useful as context.

------

Future plans? 

1. If/when we want to start serving the webpack dev server in another container, or separate dev/prod containers, this is a good starting point. The separate node build stage makes its dependencies rather explicit.




------

#### Scratchpad

```Dockerfile
# webpack-build-prod
COPY --from=npm-install /srv/src/kpi/ .
# COPY --from=npm-install --parents \
#     /srv/src/kpi/./jsapp/fonts/   \
#     /srv/src/kpi/./msw-mocks/     \
#     /srv/src/kpi/./node_modules/  \
#     /srv/src/kpi/./jsapp/k-icons-css-template.hbs \
#     /srv/src/kpi/./jsapp/svg-icons/               \
#     /srv/src/kpi/./patches/                       \
#     /srv/src/kpi/./.browserslistrc                \
#     /srv/src/kpi/./package.json                   \
#     /srv/src/kpi/./package-lock.json              \
#     .
```




```dockerfile

# before copying everything from the folder.

##################################################
# IDEA: Init the translation submodule, without  #
# creating a low-layer that's dependent on .git. #
# But, this will not update translations often.  #
# In dev, should the translations get updated on #
# startup?                                       #
##################################################
WORKDIR ${KPI_SRC_DIR}/
COPY .gitmodules "${KPI_SRC_DIR}"
RUN --mount=source=/.git,target="${KPI_SRC_DIR}/.git" \
    git submodule init && \
    git submodule update --remote
```





```

# USER kobo


# Could UV use a cache mount? 

    
#
# Questions: Is it OK if UWSGI_USER owns kpi_src_dir, etc.?  
#
# Questions: Could the prod container serve the compiled app from a non-shadowed
#     directory when not in dev mode? 

# Thinking: Does the venv need to be owned by root / in root? 
#     Would de-rooting this be a better thing for a separate PR?

```