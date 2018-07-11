FROM kobotoolbox/koboform_base:latest


# Note: Additional environment variables have been set in `Dockerfile.koboform_base`.
ENV KPI_LOGS_DIR=/srv/logs \
    KPI_WHOOSH_DIR=/srv/whoosh \
    BUILD_DIR=/srv/build \
    FONTS_DIR=/srv/fonts \
    WEBPACK_STATS_PATH=/srv/webpack-stats.json \
    DJANGO_SETTINGS_MODULE=kobo.settings \
    # The mountpoint of a volume shared with the `nginx` container. Static files will
    #   be copied there.
    NGINX_STATIC_DIR=/srv/static


##########################################
# Install any additional `apt` packages. #
##########################################

COPY ./dependencies/apt_requirements.txt "${KPI_SRC_DIR}/dependencies/"
# Only install if the current version of `dependencies/apt_requirements.txt` differs from the one used in the base image.
RUN if ! diff "${KPI_SRC_DIR}/dependencies/apt_requirements.txt" /srv/tmp/base__apt_requirements.txt; then \
        apt-get update -qq && \
        apt-get install -qqy $(cat "${KPI_SRC_DIR}/dependencies/apt_requirements.txt") && \
        apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \ 
    ; fi


###########################
# Re-sync `pip` packages. #
###########################

COPY ./dependencies/pip/external_services.txt "${KPI_SRC_DIR}/dependencies/pip/"
WORKDIR ${PIP_DIR}/
# Only install if the current version of `dependencies/pip/external_services.txt` differs from the one used in the base image.
RUN if ! diff "${KPI_SRC_DIR}/dependencies/pip/external_services.txt" /srv/tmp/base__external_services.txt; then \
        pip-sync "${KPI_SRC_DIR}/dependencies/pip/external_services.txt" 1>/dev/null \
    ; fi


##########################################
# Install any additional `npm` packages. #
##########################################

COPY ./package.json "${KPI_SRC_DIR}/"
WORKDIR ${KPI_SRC_DIR}/
# Only install if the current version of `package.json` differs from the one used in the base image.
RUN if ! diff "${KPI_SRC_DIR}/package.json" /srv/tmp/base_package.json; then \
        # Try error-prone `npm install` step twice.
        npm install --quiet || npm install --quiet \
    ; fi


######################
# Build client code. #
######################

COPY ./scripts/copy_fonts.py ${KPI_SRC_DIR}/scripts/copy_fonts.py
COPY ./scripts/generate_icons.js ${KPI_SRC_DIR}/scripts/generate_icons.js
COPY ./webpack ${KPI_SRC_DIR}/webpack
COPY ./.eslintrc ${KPI_SRC_DIR}/.eslintrc
COPY ./test ${KPI_SRC_DIR}/test

COPY ./jsapp ${KPI_SRC_DIR}/jsapp

RUN mkdir "${BUILD_DIR}" && \
    mkdir "${FONTS_DIR}" && \
    ln -s "${BUILD_DIR}" "${KPI_SRC_DIR}/jsapp/compiled" && \
    rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
    ln -s "${FONTS_DIR}" "${KPI_SRC_DIR}/jsapp/fonts" && \
    # FIXME: Move `webpack-stats.json` to some build target directory so these ad-hoc workarounds don't continue to accumulate.
    ln -s "${WEBPACK_STATS_PATH}" webpack-stats.json

RUN npm run copy-fonts && npm run build

###############################################
# Copy over this directory in its current state. #
###############################################

RUN rm -rf "${KPI_SRC_DIR}"
COPY . "${KPI_SRC_DIR}"

# Restore the backed-up package installation directories.
RUN ln -s "${KPI_NODE_PATH}" "${KPI_SRC_DIR}/node_modules" && \
    ln -s "${BUILD_DIR}" "${KPI_SRC_DIR}/jsapp/compiled" && \
    ln -s "${FONTS_DIR}" "${KPI_SRC_DIR}/jsapp/fonts" && \
    ln -s "${WEBPACK_STATS_PATH}" webpack-stats.json


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


#################################################################
# Persist the log directory, email directory, and Whoosh index. #
#################################################################

RUN mkdir -p "${KPI_LOGS_DIR}/" "${KPI_WHOOSH_DIR}/" "${KPI_SRC_DIR}/emails"


#################################################
# Handle runtime tasks and create main process. #
#################################################

# Using `/etc/profile.d/` as a repository for non-hard-coded environment variable overrides.
RUN echo 'source /etc/profile' >> /root/.bashrc

# FIXME: Allow Celery to run as root ...for now.
ENV C_FORCE_ROOT="true"

# Prepare for execution.
RUN ln -s "${KPI_SRC_DIR}/docker/init.bash" /etc/my_init.d/10_init_kpi.bash && \
    rm -rf /etc/service/wsgi && \
    mkdir -p /etc/service/uwsgi && \
    ln -s "${KPI_SRC_DIR}/docker/run_uwsgi.bash" /etc/service/uwsgi/run && \
    mkdir -p /etc/service/celery && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery.bash" /etc/service/celery/run && \
    mkdir -p /etc/service/celery_sync_kobocat_xforms && \
    ln -s "${KPI_SRC_DIR}/docker/run_celery_sync_kobocat_xforms.bash" /etc/service/celery_sync_kobocat_xforms/run

EXPOSE 8000
