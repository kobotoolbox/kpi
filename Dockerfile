FROM nikolaik/python-nodejs:python3.8-nodejs10

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
    KPI_NODE_PATH=/srv/src/kpi/node_modules \
    TMP_PATH=/srv/tmp \
    INIT_PATH=/srv/init

# Install Dockerize.
ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz -P /tmp \
    && tar -C /usr/local/bin -xzvf /tmp/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm /tmp/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz


##########################################
# Create build directories               #
##########################################

RUN mkdir -p "${NGINX_STATIC_DIR}" && \
    mkdir -p "${KPI_SRC_DIR}" && \
    mkdir -p "${KPI_NODE_PATH}" && \
    mkdir -p "${TMP_PATH}" && \
    mkdir -p "${INIT_PATH}"

##########################################
# Install `apt` packages.                #
##########################################
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -

RUN apt -qq update && \
    apt -qq -y install \
        gdal-bin \
        libproj-dev \
        gettext \
        postgresql-client \
        locales \
        runit-init \
        rsync \
        vim && \
    apt clean && \
        rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

###########################
# Install locales         #
###########################

RUN echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen
RUN locale-gen && dpkg-reconfigure locales -f noninteractive

###########################
# Copy KPI directory      #
###########################

COPY . "${KPI_SRC_DIR}"

###########################
# Install `pip` packages. #
###########################

RUN virtualenv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN pip install  --quiet --upgrade pip && \
    pip install  --quiet pip-tools
COPY ./dependencies/pip/external_services.txt /srv/tmp/pip_dependencies.txt
RUN pip-sync /srv/tmp/pip_dependencies.txt 1>/dev/null && \
    rm -rf ~/.cache/pip

###########################
# Install `npm` packages. #
###########################

WORKDIR ${KPI_SRC_DIR}/
RUN rm -rf ${KPI_NODE_PATH} && \
    npm install -g check-dependencies && \
    npm install --quiet && \
    npm cache clean --force

ENV PATH $PATH:${KPI_NODE_PATH}/.bin

######################
# Build client code. #
######################

RUN rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
    rm -rf "${KPI_SRC_DIR}/jsapp/compiled" && \
    npm run copy-fonts && npm run build

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
RUN echo "export PATH=${PATH}" >> /etc/profile
RUN echo 'source /etc/profile' >> /root/.bashrc
#
# FIXME: Allow Celery to run as root ...for now.
ENV C_FORCE_ROOT="true"

# Do it even if we don't why yet.
RUN useradd -s /bin/false -m wsgi

# Prepare for execution.
RUN rm -rf /etc/service/wsgi && \
    # Remove getty* services
    rm -rf /etc/runit/runsvdir/default/getty-tty* && \
    mkdir -p /etc/service/uwsgi && \
    ln -s "${KPI_SRC_DIR}/docker/run_uwsgi.bash" /etc/service/uwsgi/run && \
    mkdir -p /etc/service/celery && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery.bash" /etc/service/celery/run && \
    mkdir -p /etc/service/celery_beat && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery_beat.bash" /etc/service/celery_beat/run && \
    mkdir -p /etc/service/celery_sync_kobocat_xforms && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery_sync_kobocat_xforms.bash" /etc/service/celery_sync_kobocat_xforms/run

EXPOSE 8000

CMD ["/bin/bash", "-c", "exec ${KPI_SRC_DIR}/docker/init.bash"]
