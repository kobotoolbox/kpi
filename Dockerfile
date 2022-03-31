FROM python:3.8

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
    SERVICES_DIR=/etc/service \
    CELERY_PID_DIR=/var/run/celery \
    INIT_PATH=/srv/init

##########################################
# Create build directories               #
##########################################

RUN mkdir -p "${NGINX_STATIC_DIR}" && \
    mkdir -p "${KPI_SRC_DIR}" && \
    mkdir -p "${KPI_NODE_PATH}" && \
    mkdir -p "${TMP_DIR}" && \
    mkdir -p ${CELERY_PID_DIR} && \
    mkdir -p ${SERVICES_DIR}/uwsgi && \
    mkdir -p ${SERVICES_DIR}/celery && \
    mkdir -p ${SERVICES_DIR}/celery_beat && \
    mkdir -p ${SERVICES_DIR}/celery_sync_kobocat_xforms && \
    mkdir -p "${INIT_PATH}"

##########################################
# Install `apt` packages.                #
##########################################

RUN apt-get -qq update && \
    apt-get -qq -y install \
        ffmpeg \
        gdal-bin \
        gettext \
        gosu \
        less \
        libproj-dev \
        locales \
        postgresql-client \
        rsync \
        runit-init \
        vim \
        wait-for-it && \
    apt-get clean && \
        rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

###########################
# Install NodeJS          #
###########################

RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs

###########################
# Install locales         #
###########################

RUN echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen
RUN locale-gen && dpkg-reconfigure locales -f noninteractive

#################################
# Create local user UWSGI_USER` #
#################################
RUN adduser --disabled-password --gecos '' "$UWSGI_USER"

###########################
# Copy KPI directory      #
###########################

COPY . "${KPI_SRC_DIR}"

###########################
# Install `pip` packages. #
###########################

RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN pip install  --quiet --upgrade pip && \
    pip install  --quiet pip-tools
COPY ./dependencies/pip/external_services.txt "${TMP_DIR}/pip_dependencies.txt"
RUN pip-sync "${TMP_DIR}/pip_dependencies.txt" 1>/dev/null && \
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
RUN echo "export PATH=${PATH}" >> /etc/profile && \
    echo 'source /etc/profile' >> /root/.bashrc && \
    echo 'source /etc/profile' >> /home/${UWSGI_USER}/.bashrc


# Remove getty* services to avoid errors of absent tty at sv start-up
RUN rm -rf /etc/runit/runsvdir/default/getty-tty*

# Create symlinks for runsv services
RUN ln -s "${KPI_SRC_DIR}/docker/run_uwsgi.bash" "${SERVICES_DIR}/uwsgi/run" && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery.bash" "${SERVICES_DIR}/celery/run" && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery_beat.bash" "${SERVICES_DIR}/celery_beat/run" && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery_sync_kobocat_xforms.bash" "${SERVICES_DIR}/celery_sync_kobocat_xforms/run"


# Add/Restore `UWSGI_USER`'s permissions
RUN chown -R ":${UWSGI_GROUP}" ${CELERY_PID_DIR} && \
    chmod g+w ${CELERY_PID_DIR} && \
    chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${KPI_SRC_DIR}/emails/ && \
    chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${KPI_LOGS_DIR} && \
    chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${TMP_DIR} && \
    chown -R "${UWSGI_USER}:${UWSGI_GROUP}" ${VIRTUAL_ENV}


EXPOSE 8000

CMD ["/bin/bash", "-c", "exec ${KPI_SRC_DIR}/docker/init.bash"]
