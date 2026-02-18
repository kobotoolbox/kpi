# syntax=docker/dockerfile:labs
# ^  Tell BuildKit to pull the latest 'labs' version
#    of the Dockerfile syntax before the build.
#    -  Access newer BuildKit syntax features, e.g. `COPY --parents`
#      https://docs.docker.com/build/buildkit/frontend/#dockerfile-frontend
#    - Improve compatibility for CI runners, which might be
#      running a slightly older version of docker.

#########################################
# The Dockerfile has 4 stages now:      #
#  1. 📦 Node 'npm-install'             #
#  2. 🛠️ Node 'webpack-build-prod'      #
#  3. 🐍 Python 'pip-dependencies'      #
#  4. 🧰 KPI production image 'kpi-app' #
#########################################

# If you update a base image, make sure to update the
# runners in .github/workflows/ to the corresponding 
# Ubuntu version.


#########################
#                       #
# 📦 Node 'npm-install' #
#                       #
#########################

FROM node:20.19-bookworm-slim AS npm-install
WORKDIR /srv/src/kpi

# This is our non-root user 1000.
RUN chown node:node .

# Icon source files are in their own layer
#  because they're less commonly updated.
COPY --chown=node:node --parents \
    jsapp/k-icons-css-template.hbs \
    jsapp/svg-icons/ \
    .

# Copy all sources from the build context
# that would affect the outcome of 'npm clean-install'.
COPY --chown=node:node --parents \
    patches/                  \
    scripts/copy_fonts.sh     \
    scripts/generate_icons.js \
    scripts/hints.js          \
    .browserslistrc    \
    package.json       \
    package-lock.json  \
    .

# Run npm clean-install as non-root user,
# and clean the cache for space.
USER node
RUN npm clean-install \
    && npm cache clean --force

# Results in /srv/src/kpi/:
#   All the sources copied above, plus the generated:
#   + jsapp/fonts/
#   + msw-mocks/
#   + node_modules/

################################
#                              #
# 🛠️ Node 'webpack-build-prod' #
#                              #
################################
FROM node:20.19-bookworm-slim AS webpack-build-prod
WORKDIR /srv/src/kpi
RUN chown node:node .

# Copy inputs from the 'npm-install' stage.
# (These were generated during post-install.)
COPY --from=npm-install --parents \
    /srv/src/kpi/./jsapp/fonts/   \
    /srv/src/kpi/./msw-mocks/     \
    .

# Copy other webpack build inputs from the
# build context.
COPY --chown=node:node --parents \
    jsapp/            \
    patches/          \
    scripts/          \
    webpack/          \
    .babelrc.json     \
    .browserslistrc   \
    .gitignore        \
    .node-version     \
    .nvmrc            \
    .swcrc            \
    orval.config.js   \
    package.json      \
    package-lock.json \
    tsconfig.json     \
    .

# We now have everything we need in /src/srv/kpi/ to
# build the prod webpack app now, except for node_modules.

# For node_modules, we can bind mount it from the 'npm-install'
# stage instead of copying. (This avoids creating another
# 0.6 GB layer in this stage.)

# Build the prod app (as non-root user)
USER node
RUN --mount=from=npm-install,source=/srv/src/kpi/node_modules,target=/srv/src/kpi/node_modules \
    SKIP_TS_CHECK=true          \
    ./node_modules/.bin/webpack \
    --config webpack/prod.config.js

# Results in /srv/src/kpi/:
#   All source files copied above, plus the generated:
#   + jsapp/compiled/*
#   + webpack-stats.json



################################
#                              #
# 🐍 Python 'pip-dependencies' #
#                              #
################################
FROM ghcr.io/astral-sh/uv:python3.10-bookworm AS pip-dependencies
ENV TMP_DIR=/srv/tmp \
    VIRTUAL_ENV=/opt/venv
RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY ./dependencies/pip/requirements.txt "${TMP_DIR}/pip_dependencies.txt"
RUN uv pip sync "${TMP_DIR}/pip_dependencies.txt" 1>/dev/null

#####################################
#                                   #
# 🧰 KPI production image 'kpi-app' #
#                                   #
#####################################
FROM ghcr.io/astral-sh/uv:python3.10-bookworm-slim AS kpi-app

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

###########################
# Install `apt` packages. #
###########################

# DO NOT remove packages like `less` and `procps` without approval from
# jnm (or the current on-call sysadmin). Thanks.
RUN apt-get -qq update && \
    apt-get -qq -y install curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get -qq -y install --no-install-recommends \
        ffmpeg \
        gdal-bin \
        gettext \
        git \
        gosu \
        less \
        libproj-dev \
        locales \
        # pin an exact Node version for stability. update this regularly.
        nodejs=$(apt-cache show nodejs | grep -F 'Version: 20.18.1' | cut -f 2 -d ' ') \
        openjdk-17-jre \
        postgresql-client \
        procps \
        rsync \
        vim-tiny \
        wait-for-it && \
    apt-get clean && \
        rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

####################
# Install locales. #
####################

RUN echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen && \
    locale-gen && dpkg-reconfigure locales -f noninteractive

##########################################
# Set environment variables and workdir. #
##########################################

# Note: NGINX_STATIC_DIR is the mountpoint of a volume
#    shared with the `nginx` container.
#    Static files will be copied there.
ENV DJANGO_SETTINGS_MODULE=kobo.settings.prod \
    INIT_PATH=/srv/init                       \
    KPI_LOGS_DIR=/srv/logs                    \
    KPI_MEDIA_DIR=/srv/src/kpi/media          \
    KPI_NODE_PATH=/srv/src/kpi/node_modules   \
    KPI_SRC_DIR=/srv/src/kpi                  \
    NGINX_STATIC_DIR=/srv/static              \
    OPENROSA_MEDIA_DIR=/srv/src/kobocat/media \
    TMP_DIR=/srv/tmp                          \
    UWSGI_USER=kobo                           \
    UWSGI_GROUP=kobo                          \
    VIRTUAL_ENV=/opt/venv

WORKDIR ${KPI_SRC_DIR}/

####################################
# Create local non-root user 1000  #
####################################
RUN adduser --disabled-password --gecos '' "$UWSGI_USER"

#################################################
# Set up Node for kobo-docker lifecycle scripts #
#   (see ./docker/entrypoint.sh)                #
#################################################
RUN mkdir -p "${TMP_DIR}/.npm" && \
    npm config set cache "${TMP_DIR}/.npm" --global && \
    npm install --global --production github:mgol/check-dependencies#bfc3d06ba7d52b5ea9770f708d882526488eeb7d && \
    npm cache clean --force

###############################################
# Copy sources from context and build stages. #
###############################################

# Copy KPI directory from build context.
COPY . "${KPI_SRC_DIR}"

# Copy virtualenv from 'pip-dependencies'.
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY --from=pip-dependencies "$VIRTUAL_ENV" "$VIRTUAL_ENV"

RUN rm -rf ${VIRTUAL_ENV}/lib/python3.10/site-packages/rest_framework/static/rest_framework

# Copy static production build from 'webpack-build-prod'.
COPY --from=webpack-build-prod --parents \
    ${KPI_SRC_DIR}/./jsapp/compiled/     \
    ${KPI_SRC_DIR}/./webpack-stats.json  \
    .
###########################
# Organize static assets. #
###########################
RUN python manage.py collectstatic --noinput --ignore rest_framework

RUN rm -rf ${KPI_SRC_DIR}/staticfiles/rest_framework/

######################################
# Retrieve and compile translations. #
######################################
RUN git submodule init && \
    git submodule update --remote && \
    python manage.py compilemessages

##########################################
# Persist the log and email directories. #
##########################################
RUN mkdir -p \
    "${KPI_LOGS_DIR}/" \
    "${KPI_SRC_DIR}/emails"

#################################################
# Handle runtime tasks and create main process. #
#################################################

# Using `/etc/profile.d/` as a repository for non-hard-coded environment variable overrides.
RUN echo "export PATH=${PATH}" >> /etc/profile && \
    echo 'source /etc/profile' >> /root/.bashrc && \
    echo 'source /etc/profile' >> /home/${UWSGI_USER}/.bashrc

# Add/Restore `UWSGI_USER`'s permissions
# chown of `${TMP_DIR}/.npm` is a hack needed for kobo-install-based staging deployments;
# see internal discussion at https://chat.kobotoolbox.org/#narrow/stream/4-Kobo-Dev/topic/Unu.2C.20du.2C.20tri.2C.20kvar.20deployments/near/322075
RUN chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${KPI_SRC_DIR}/emails/ && \
    chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${KPI_LOGS_DIR} && \
    chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${TMP_DIR} && \
    chown -R root:root "${TMP_DIR}/.npm"

# ##############################################################
# # TMP 2026/01/29 - kpi#6498                                  #
# #   Retain a copy of node_modules in the KPI container,      #
# #   so that people don't have to update their workflows yet. #
# ##############################################################
COPY --from=npm-install --parents \
    /srv/src/kpi/./node_modules/  \
    .
# ##############################################################

# Add node_modules/.bin to PATH,
# in case scripts are relying on it.
ENV PATH=$PATH:${KPI_NODE_PATH}/.bin

EXPOSE 8000

CMD ["/bin/bash", "docker/entrypoint.sh"]
