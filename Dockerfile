FROM teodorescuserban/kobo-base:latest

COPY ./apt_packages.txt /srv/src/
WORKDIR /srv/src/
RUN apt-get update && \
    apt-get install -qy $(cat apt_packages.txt)
RUN ln -s $(echo `which nodejs`) $(echo `dirname $(which nodejs)`/node)
COPY ./requirements.txt /srv/src
RUN pip install -r requirements.txt
COPY . /srv/src/kpi
WORKDIR /srv/src/kpi
RUN npm install
ENV PATH $PATH:/srv/src/kpi/node_modules/.bin
RUN grunt buildall
ENV DJANGO_SETTINGS_MODULE kobo_playground.settings
