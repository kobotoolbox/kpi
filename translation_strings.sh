#!/usr/bin/bash

blue="\e[0;94m"
reset="\e[0m"

echo -e "${blue}Installing translate-toolkit${reset}"
apt update -qq
apt install translate-toolkit -qq --yes
echo -e "${blue}Instaling transifex-client${reset}"
pip install transifex-client -qq
echo -e "${blue}Converting .json to .po file${reset}"
json2po jsapp/compiled/extracted-strings.json locale/en/LC_MESSAGES/djangojs.po
echo -e "${blue}Collecting all python strings${reset}"
./manage.py makemessages --locale en
cd locale/
echo -e "${blue}Pushing strings to Transifex${reset}"
tx push -s
echo -e "${blue}Done!${reset}"
