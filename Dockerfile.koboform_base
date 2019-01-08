# Base image to take care of `apt`, `pip`, and `npm` dependencies. Packages are
#   stored outside the source directory so it can be overwritten in development scenarios.

FROM kobotoolbox/base-kobos:latest


ENV KPI_SRC_DIR=/srv/src/kpi \
    KPI_NODE_PATH=/srv/node_modules \
    PIP_DIR=/srv/pip


###############################
# Prepare to install Node 8.x #
###############################

RUN echo 'deb https://deb.nodesource.com/node_8.x xenial main' > /etc/apt/sources.list.d/nodesource.list && \
    wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -


###########################
# Install `apt` packages. #
###########################

COPY ./dependencies/apt_requirements.txt /srv/tmp/base__apt_requirements.txt
RUN apt-get update -qq && \
    apt-get install -qq nodejs $(cat /srv/tmp/base__apt_requirements.txt) && \
    apt-get -qq --purge autoremove && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*


###########################
# Install `pip` packages. #
###########################

WORKDIR ${PIP_DIR}/
RUN pip install --quiet 'pip>=9,<10' && \
    pip install --quiet 'pip-tools>=1.11,<2'
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
    npm install --quiet && \
    npm cache clean --force && \
    mv "${KPI_SRC_DIR}/package.json" /srv/tmp/base_package.json
ENV PATH $PATH:${KPI_NODE_PATH}/.bin
