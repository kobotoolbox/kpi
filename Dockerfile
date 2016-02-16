FROM kobotoolbox/base-kobos:docker_local

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

RUN mkdir -p /etc/service/uwsgi/

# FIXME: Allow Celery to run as root.
ENV C_FORCE_ROOT="true"

# Prepare for execution.
COPY ./docker/init.bash /etc/my_init.d/10_init_kpi.bash
RUN rm -rf /etc/service/wsgi && \
    mkdir -p /etc/service/uwsgi
COPY ./docker/run_uwsgi.bash /etc/service/uwsgi/run

EXPOSE 8000
