FROM teodorescuserban/kobo-base:latest

COPY ./apt_packages.txt /srv/src/kpi/

WORKDIR /srv/src/kpi/
RUN apt-get update && \
    apt-get install -qy $(cat apt_packages.txt)
RUN ln -s $(echo `which nodejs`) $(echo `dirname $(which nodejs)`/node)

COPY ./requirements.txt /srv/src/kpi/
RUN pip install -r requirements.txt

COPY ./package.json /srv/src/kpi/
RUN npm install
ENV PATH $PATH:/srv/src/kpi/node_modules/.bin

COPY ./bower.json ./.bowerrc /srv/src/kpi/
RUN bower install --allow-root

COPY . /srv/src/kpi
RUN grunt buildall

ENV DJANGO_SETTINGS_MODULE kobo_playground.settings
RUN echo 'yes' | python manage.py collectstatic && \
    python manage.py migrate
