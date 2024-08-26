FROM python:3.10 as build-python

ENV VIRTUAL_ENV=/opt/venv \
    TMP_DIR=/srv/tmp

RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN pip install --quiet pip-tools==7.\*
COPY ./dependencies/pip/requirements.txt "${TMP_DIR}/pip_dependencies.txt"
RUN pip-sync "${TMP_DIR}/pip_dependencies.txt" 1>/dev/null


from python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV VIRTUAL_ENV=/opt/venv

ENV KPI_LOGS_DIR=/srv/logs \
    DJANGO_SETTINGS_MODULE=kobo.settings.prod \
    # The mountpoint of a volume shared with the `nginx` container. Static files will
    #   be copied there.
    NGINX_STATIC_DIR=/srv/static \
    KPI_SRC_DIR=/srv/src/kpi \
    KPI_MEDIA_DIR=/srv/src/kpi/media \
    KPI_NODE_PATH=/srv/src/kpi/node_modules \
    TMP_DIR=/srv/tmp \
    UWSGI_USER=kobo \
    UWSGI_GROUP=kobo \
    INIT_PATH=/srv/init

##########################################
# Create build directories               #
##########################################

RUN mkdir -p "${NGINX_STATIC_DIR}" && \
    mkdir -p "${KPI_SRC_DIR}" && \
    mkdir -p "${KPI_NODE_PATH}" && \
    mkdir -p "${TMP_DIR}"

##########################################
# Install `apt` packages.                #
##########################################

# DO NOT remove packages like `less` and `procps` without approval from
# jnm (or the current on-call sysadmin). Thanks.

RUN apt-get -qq update && \
    apt-get -qq -y install ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_16.x nodistro main" \
        | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get -qq update && \
    apt-get -qq -y install openjdk-17-jre && \
    apt-get -qq -y install --no-install-recommends \
        ffmpeg \
        gdal-bin \
        gettext \
        git \
        gosu \
        less \
        libproj-dev \
        locales \
        nodejs=$(apt-cache show nodejs | grep -F 'Version: 16.15.0' | cut -f 2 -d ' ') \
        postgresql-client \
        procps \
        rsync \
        vim-tiny \
        wait-for-it && \
    apt-get clean && \
        rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

###########################
# Install locales         #
###########################

RUN echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen && \
    locale-gen && dpkg-reconfigure locales -f noninteractive

#################################
# Create local user UWSGI_USER` #
#################################
RUN adduser --disabled-password --gecos '' "$UWSGI_USER"

###########################
# Copy KPI directory      #
###########################

COPY . "${KPI_SRC_DIR}"

###########################
# Copy virtualenv         #
###########################

ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY ./dependencies/pip/requirements.txt "${TMP_DIR}/pip_dependencies.txt"
COPY --from=build-python "$VIRTUAL_ENV" "$VIRTUAL_ENV"

###########################
# Install `npm` packages. #
###########################

WORKDIR ${KPI_SRC_DIR}/

RUN rm -rf ${KPI_NODE_PATH} && \
    mkdir -p "${TMP_DIR}/.npm" && \
    npm config set cache "${TMP_DIR}/.npm" --global && \
    npm install -g npm@8.5.5 && \
    npm install -g check-dependencies@1 && \
    rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
    rm -rf "${KPI_SRC_DIR}/jsapp/compiled" && \
    npm install --quiet && \
    npm cache clean --force

ENV PATH $PATH:${KPI_NODE_PATH}/.bin

######################
# Build client code. #
######################

RUN npm run build

###########################
# Organize static assets. #
###########################

RUN python manage.py collectstatic --noinput

#####################################
# Retrieve and compile translations #
#####################################

RUN git submodule init && \
    git submodule update --remote && \
    python manage.py compilemessages

##########################################
# Persist the log and email directories. #
##########################################

RUN mkdir -p "${KPI_LOGS_DIR}/" "${KPI_SRC_DIR}/emails"

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


EXPOSE 8000

CMD ["/bin/bash", "docker/entrypoint.sh"]
