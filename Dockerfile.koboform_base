# Base image to take care of `apt`, `pip`, `npm`, and `bower dependencies. Packages are
#   stored outside the source directory so it can be overwritten in development scenarios.

FROM kobotoolbox/base-kobos:latest


ENV KPI_SRC_DIR=/srv/src/kpi \
    KPI_NODE_PATH=/srv/node_modules \
    BOWER_COMPONENTS_DIR=/srv/bower_components


###############################
# Prepare to install Node 6.x #
###############################

ADD https://deb.nodesource.com/setup_6.x /tmp/setup_6.x.bash


###########################
# Install `apt` packages. #
###########################

COPY ./dependencies/apt_requirements.txt /srv/tmp/base__apt_requirements.txt
RUN bash /tmp/setup_6.x.bash && \
    apt-get update -qq && \
    apt-get install -qqy $(cat /srv/tmp/base__apt_requirements.txt) && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*


###########################
# Install `pip` packages. #
###########################

RUN pip install --quiet --upgrade pip && \
    pip install --quiet pip-tools
COPY ./dependencies/pip/external_services.txt /srv/tmp/base__external_services.txt
RUN pip-sync /srv/tmp/base__external_services.txt 1>/dev/null && \
    rm -rf ~/.cache/pip


###########################
# Install `npm` packages. #
###########################

COPY ./package.json ${KPI_SRC_DIR}/
WORKDIR ${KPI_SRC_DIR}/
RUN mkdir -p "${KPI_NODE_PATH}" && \
    ln -s "${KPI_NODE_PATH}" "${KPI_SRC_DIR}/node_modules" && \
    # Try error-prone `npm install` step multiple times taking care that `phantomjs` installation succeeds.
    for trial_number in $(seq 1 4); do \
        npm install --quiet > npm_install_log.txt 2>&1 && \
        return_status="$?" && \
        phantomjs_error="$(grep 'ERR' npm_install_log.txt | grep -q 'phantomjs' && echo 'True' || echo 'False')" && \
        if [ "${phantomjs_error}" = 'True' ]; then npm uninstall phantomjs node-sass \
        ; elif [ "${return_status}" = '0' ]; then break; fi && \
        echo "\`npm install\` trial ${trial_number} failed." \
    ; done && \
    if [ "${return_status}" != '0' ]; then exit "${return_status}"; fi && \
    npm cache clean && \
    mv "${KPI_SRC_DIR}/package.json" /srv/tmp/base_package.json && \
    mv "${KPI_SRC_DIR}/npm_install_log.txt" /srv/tmp/
ENV PATH $PATH:${KPI_NODE_PATH}/.bin


#############################
# Install `bower` packages. #
#############################

COPY ./bower.json ./.bowerrc ${KPI_SRC_DIR}/
RUN mkdir -p "${BOWER_COMPONENTS_DIR}" && \
    mkdir -p "${KPI_SRC_DIR}/jsapp/xlform/" && \
    ln -s "${BOWER_COMPONENTS_DIR}/" "${KPI_SRC_DIR}/jsapp/xlform/components" && \
    bower install --quiet --allow-root --config.interactive=false && \
    bower cache clean --allow-root && \
    mv "${KPI_SRC_DIR}/bower.json" /srv/tmp/base_bower.json && \
    mv "${KPI_SRC_DIR}/.bowerrc" /srv/tmp/base_bowerrc
