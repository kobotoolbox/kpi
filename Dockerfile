FROM kobotoolbox/koboform_base:latest


# Note: Additional environment variables established in `Dockerfile.koboform_base`.
ENV KPI_LOGS_DIR=/srv/logs \
    KPI_WHOOSH_DIR=/srv/whoosh \
    # STATICFILES_DIR=/srv/staticfiles \
    GRUNT_BUILD_DIR=/srv/grunt_build \
    GRUNT_FONTS_DIR=/srv/grunt_fonts \
    # The mountpoint of a volume shared with the nginx container. Static files will
    # be copied there.
    NGINX_STATIC_DIR=/srv/static


##########################################
# Install any additional `apt` packages. #
##########################################

COPY ./apt_requirements.txt ${KPI_SRC_DIR}/
# Only install if the current version of `apt_requirements.txt` differs from the one used in the base image.
RUN diff -q "${KPI_SRC_DIR}/apt_requirements.txt" "/srv/tmp/base_apt_requirements.txt" || \
        ( apt-get update && \
        apt-get install -y $(cat ${KPI_SRC_DIR}/apt_requirements.txt) && \
        apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* ) \ 
    || true # Prevent non-zero exit code.


###########################
# Re-sync `pip` packages. #
###########################

COPY ./requirements.txt ${KPI_SRC_DIR}/
# Only install if the current version of `requirements.txt` differs from the one used in the base image.
RUN diff -q "${KPI_SRC_DIR}/requirements.txt" /srv/tmp/base_requirements.txt || \
    pip-sync "${KPI_SRC_DIR}/requirements.txt" \
    || true # Prevent non-zero exit code.


##########################################
# Install any additional `npm` packages. #
##########################################

COPY ./package.json ${KPI_SRC_DIR}/
# Only install if the current version of `package.json` differs from the one used in the base image.
RUN diff -q "${KPI_SRC_DIR}/package.json" /srv/tmp/base_package.json || \
    npm install \
    || true # Prevent non-zero exit code.


##########################################
# Install any additional Bower packages. #
##########################################

COPY ./bower.json ./.bowerrc ${KPI_SRC_DIR}/
# Only install if the current versions of `bower.json` or `.bowerrc` differ from the ones used in the base image.
RUN (   diff -q "${KPI_SRC_DIR}/bower.json" /srv/tmp/base_bower.json && \
        diff -q "${KPI_SRC_DIR}/.bowerrc" /srv/tmp/base_bowerrc ) || \
    bower install --allow-root --config.interactive=false \
    || true # Prevent non-zero exit code.


######################
# Build client code. #
######################

COPY ./Gruntfile.js ${KPI_SRC_DIR}/
COPY ./webpack* ${KPI_SRC_DIR}/
COPY ./helper/webpack-config.js ${KPI_SRC_DIR}/helper/wepback-config.js

COPY ./jsapp ${KPI_SRC_DIR}/jsapp

RUN mkdir "${GRUNT_BUILD_DIR}" && \
    mkdir "${GRUNT_FONTS_DIR}" && \
    ln -s "${GRUNT_BUILD_DIR}" "${KPI_SRC_DIR}/jsapp/compiled" && \
    rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
    ln -s "${GRUNT_FONTS_DIR}" "${KPI_SRC_DIR}/jsapp/fonts" && \
    grunt buildall && \
    npm run build-production


###############################################
# Copy over this directory in its current state. #
###############################################

RUN rm -rf "${KPI_SRC_DIR}"
COPY . ${KPI_SRC_DIR}
# Restore the backed-up package installation directories.
RUN ln -s "${NODE_PATH}" "${KPI_SRC_DIR}/node_modules" && \
#    ln -s "${STATICFILES_DIR}" "${KPI_SRC_DIR}/staticfiles" && \
    ln -s "${BOWER_COMPONENTS_DIR}/" "${KPI_SRC_DIR}/jsapp/xlform/components" && \
    ln -s "${GRUNT_BUILD_DIR}" "${KPI_SRC_DIR}/jsapp/compiled" && \
    ln -s "${GRUNT_FONTS_DIR}" "${KPI_SRC_DIR}/jsapp/fonts"


###########################
# Organize static assets. #
###########################

ENV DJANGO_SETTINGS_MODULE kobo_playground.settings
RUN python manage.py collectstatic --noinput


#################################################################
# Persist the log directory, email directory, and Whoosh index. #
#################################################################

RUN mkdir -p "${KPI_LOGS_DIR}/" "${KPI_WHOOSH_DIR}/" "${KPI_SRC_DIR}/emails"
VOLUME "${KPI_LOGS_DIR}/" "${KPI_WHOOSH_DIR}/" "${KPI_SRC_DIR}/emails"


#################################################
# Handle runtime tasks and create main process. #
#################################################

# Using `/etc/profile.d/` as a repository for non-hard-coded environment variable overrides.
RUN echo 'source /etc/profile' >> /root/.bashrc

# FIXME: Allow Celery to run as root ...for now.
ENV C_FORCE_ROOT="true"

# Prepare for execution.
COPY ./docker/init.bash /etc/my_init.d/10_init_kpi.bash
RUN rm -rf /etc/service/wsgi && \
    mkdir -p /etc/service/uwsgi
COPY ./docker/run_uwsgi.bash /etc/service/uwsgi/run

EXPOSE 8000
