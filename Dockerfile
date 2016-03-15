FROM kobotoolbox/base-kobos:latest

ENV KPI_SRC_DIR=/srv/src/kpi \
    KPI_LOGS_DIR=/srv/logs \
    KPI_WHOOSH_DIR=/srv/whoosh \
    NODE_PATH=/srv/node_modules \
    PIP_EDITABLE_PACKAGE_DIR=/srv/pip_editable_packages
# The mountpoint of a volume shared with the nginx container. Static files will
# be copied there.
ENV NGINX_STATIC_DIR=/srv/static

###########################
# Install `apt` packages. #
###########################

COPY ./apt_requirements.txt ${KPI_SRC_DIR}/
WORKDIR ${KPI_SRC_DIR}/
RUN apt-get update && \
    apt-get install -y $(cat ${KPI_SRC_DIR}/apt_requirements.txt) && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

#########################
# Install pip packages. #
#########################

# Install Git so `pyxform` and Whoosh can be installed directly from the repo.
RUN apt-get update && \
    apt-get install -y git-core && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN pip install pip-tools
COPY ./requirements.txt ${KPI_SRC_DIR}/
# Install the packages, storing editable packages outside the `kpi` directory (see https://github.com/nvie/pip-tools/issues/332)
RUN mkdir -p "${PIP_EDITABLE_PACKAGE_DIR}/" && \
    ln -s "${PIP_EDITABLE_PACKAGE_DIR}/" "${KPI_SRC_DIR}/src" && \
    pip-sync requirements.txt


#########################
# Install NPM packages. #
#########################

COPY ./package.json ${KPI_SRC_DIR}/
RUN npm install && \
    mv "${KPI_SRC_DIR}/node_modules" "${NODE_PATH}" && \
    ln -s "${NODE_PATH}" "${KPI_SRC_DIR}/node_modules"
ENV PATH $PATH:${NODE_PATH}/.bin


###########################
# Install Bower packages. #
###########################

COPY ./bower.json ./.bowerrc ${KPI_SRC_DIR}/
RUN bower install --allow-root --config.interactive=false


##################
# Install uwsgi. #
##################

RUN apt-get install libpcre3 libpcre3-dev && \
    pip install uwsgi


##########
# Grunt. #
##########

COPY ./Gruntfile.js ./jsapp/ ${KPI_SRC_DIR}/
RUN grunt buildall


###########
# Django. #
###########

ENV DJANGO_SETTINGS_MODULE kobo_playground.settings
COPY . ${KPI_SRC_DIR}
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
