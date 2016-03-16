FROM kobotoolbox/koboform_base:latest


##########################################
# Install any additional `apt` packages. #
##########################################

COPY ./apt_requirements.txt ${KPI_SRC_DIR}/
RUN diff -q "${KPI_SRC_DIR}/apt_requirements.txt" "/srv/tmp/base_apt_requirements.txt" || \
        ( apt-get update && \
        apt-get install -y $(cat ${KPI_SRC_DIR}/apt_requirements.txt) && \
        apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* ) \ 
    || true # Prevent non-zero exit code.


###########################
# Re-sync `pip` packages. #
###########################

COPY ./requirements.txt ${KPI_SRC_DIR}/
# Install the packages, storing editable packages outside the `kpi` directory (see https://github.com/nvie/pip-tools/issues/332)
RUN diff -q "${KPI_SRC_DIR}/requirements.txt" /srv/tmp/base_requirements.txt || \
    pip-sync "${KPI_SRC_DIR}/base_requirements.txt" \
    || true # Prevent non-zero exit code.


##########################################
# Install any additional `npm` packages. #
##########################################

COPY ./package.json ${KPI_SRC_DIR}/
RUN diff -q "${KPI_SRC_DIR}/package.json" /srv/tmp/base_package.json || \
    npm install \
    || true # Prevent non-zero exit code.

##########################################
# Install any additional Bower packages. #
##########################################

COPY ./bower.json ./.bowerrc ${KPI_SRC_DIR}/
RUN (   diff -q "${KPI_SRC_DIR}/bower.json" /srv/tmp/base_bower.json && \
        diff -q "${KPI_SRC_DIR}/.bowerrc" /srv/tmp/base_bowerrc ) || \
    bower install --allow-root --config.interactive=false \
    || true # Prevent non-zero exit code.


###############################################
# Copy over this directory in its live state. #
###############################################

RUN rm -rf "${KPI_SRC_DIR}"
COPY . ${KPI_SRC_DIR}
RUN rm -rf "${KPI_SRC_DIR}/node_modules" && \
    rm -rf "${KPI_SRC_DIR}/staticfiles" && \
    rm -rf "${KPI_SRC_DIR}/jsapp/xlform/components" && \
    ln -s "${NODE_PATH}" "${KPI_SRC_DIR}/node_modules" && \
#    ln -s "${STATICFILES_DIR}" "${KPI_SRC_DIR}/staticfiles" && \
    ln -s "${BOWER_COMPONENTS_DIR}/" "${KPI_SRC_DIR}/jsapp/xlform/components"


######################
# Build client code. #
######################

# FIXME: To use Docker's caching mechanism and avoid unnecessary rebuilds, the inputs and outputs of the `grunt` build need to be identified.
#COPY ./Gruntfile.js ./jsapp/ ${KPI_SRC_DIR}/
#RUN mkdir "${STATICFILES_DIR}" && \
#    ln -s "${STATICFILES_DIR}" "${KPI_SRC_DIR}/staticfiles" && \
#    grunt buildall
RUN grunt buildall

###########
# Django. #
###########

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
