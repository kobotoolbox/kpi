FROM ubuntu:trusty


#########################
# Install apt packages. #
#########################

COPY ./apt_packages.txt /srv/src/kpi/
WORKDIR /srv/src/kpi/
RUN apt-get update && \
    apt-get install -qy $(cat apt_packages.txt)
RUN ln -s $(echo `which nodejs`) $(echo `dirname $(which nodejs)`/node)


#########################
# Install pip packages. #
#########################
#FIXME
RUN apt-get install -y git-core
COPY ./requirements.txt /srv/src/kpi/
RUN pip install -r requirements.txt


#########################
# Install NPM packages. #
#########################

COPY ./package.json /srv/src/kpi/
RUN npm install
ENV PATH $PATH:/srv/src/kpi/node_modules/.bin


###########################
# Install Bower packages. #
###########################

COPY ./bower.json ./.bowerrc /srv/src/kpi/
RUN bower install --allow-root --config.interactive=false


##################
# Install uwsgi. #
##################

RUN apt-get install libpcre3 libpcre3-dev && \
    pip install uwsgi


##########
# Grunt. #
##########

COPY . /srv/src/kpi
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
#RUN mkdir -p /etc/service/uwsgi/ && \
#    echo '#!/bin/bash \n echo "not a cat"' >> /etc/service/uwsgi/run
#    #echo '#!/usr/bin/env bash \n uwsgi --ini /srv/src/uwsgi.ini' >> /etc/service/uwsgi/run

EXPOSE 8000
CMD /usr/local/bin/uwsgi --ini /srv/src/kpi/uwsgi.ini
