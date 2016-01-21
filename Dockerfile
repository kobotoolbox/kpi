FROM kobotoolbox/base-kobos:latest

ENV KPI_SRC_DIR=/srv/src/kpi \
    KPI_LOGS_DIR=/srv/logs \
    KPI_WHOOSH_DIR=/srv/whoosh
# The mountpoint of a volume shared with the nginx container. Static files will
# be copied there.
ENV NGINX_STATIC_DIR=/srv/static


#########################
# Install pip packages. #
#########################
#FIXME
WORKDIR ${KPI_SRC_DIR}/
RUN apt-get install -y git-core
COPY ./requirements.txt ${KPI_SRC_DIR}/
RUN pip install -r requirements.txt


#########################
# Install NPM packages. #
#########################

COPY ./package.json ${KPI_SRC_DIR}/
RUN npm install
ENV PATH $PATH:${KPI_SRC_DIR}/node_modules/.bin


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

COPY . ${KPI_SRC_DIR}
RUN grunt buildall


###########
# Django. #
###########

ENV DJANGO_SETTINGS_MODULE kobo_playground.settings
RUN python manage.py collectstatic --noinput


###############################################
# Persist the log directory and Whoosh index. #
###############################################

RUN mkdir "${KPI_LOGS_DIR}/" "${KPI_WHOOSH_DIR}/"
VOLUME "${KPI_LOGS_DIR}/" "${KPI_WHOOSH_DIR}/"


#################################################
# Handle runtime tasks and create main process. #
#################################################
# FIXME: Pending reversion to Phusion-based base image.
#RUN mkdir -p /etc/service/uwsgi/ && \
#    echo '#!/bin/bash \n echo "not a cat"' >> /etc/service/uwsgi/run
#    #echo '#!/usr/bin/env bash \n uwsgi --ini /srv/src/uwsgi.ini' >> /etc/service/uwsgi/run

# FIXME: Allow Celery to run as root.
ENV C_FORCE_ROOT="true"

EXPOSE 8000
CMD cd "${KPI_SRC_DIR}" && \
    python manage.py migrate --noinput && \
    echo "Copying static files to nginx volume..." && \
    rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/" && \
    echo "Starting uwsgi..." && \
    /usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"
