FROM ubuntu:trusty

EXPOSE 8000
ENV KPI_SRC_DIR=/srv/src/kpi \
    KPI_LOGS_DIR=/srv/logs
CMD /usr/local/bin/uwsgi --ini ${KPI_SRC_DIR}/uwsgi.ini

#########################
# Install apt packages. #
#########################

COPY ./apt_packages.txt ${KPI_SRC_DIR}/
WORKDIR ${KPI_SRC_DIR}/
RUN apt-get update && \
    apt-get install -qy $(cat apt_packages.txt)
RUN ln -s $(echo `which nodejs`) $(echo `dirname $(which nodejs)`/node)


#########################
# Install pip packages. #
#########################
#FIXME
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
RUN echo 'yes' | python manage.py collectstatic && \
    python manage.py migrate


########################
# Create main process. #
########################
# FIXME: Pending reversion to Phusion-based base image.
#RUN mkdir -p /etc/service/uwsgi/ && \
#    echo '#!/bin/bash \n echo "not a cat"' >> /etc/service/uwsgi/run
#    #echo '#!/usr/bin/env bash \n uwsgi --ini /srv/src/uwsgi.ini' >> /etc/service/uwsgi/run

##############################
# Persist the log directory. #
##############################

RUN mkdir ${KPI_LOGS_DIR}/
VOLUME ${KPI_LOGS_DIR}/


# FIXME: Allow Celery to run as root.
ENV C_FORCE_ROOT="true"
