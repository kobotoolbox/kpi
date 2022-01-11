# coding: utf-8
# 😬
from django.utils.translation import ugettext_lazy as _

# This file is a place to store static, translatable strings

SECTORS = (
    # (value, human-readable label)
    ("Public Administration", _("Public Administration")),
    ("Arts, Entertainment, and Recreation", _("Arts, Entertainment, and Recreation")),
    ("Educational Services / Higher Education", _("Educational Services / Higher Education")),
    ("Health Services / Public Health", _("Health Services / Public Health")),
    ("Finance and Insurance", _("Finance and Insurance")),
    ("Information / Media", _("Information / Media")),
    ("Economic/Social Development", _("Economic/Social Development")),
    ("Security / Police / Peacekeeping", _("Security / Police / Peacekeeping")),
    ("Disarmament & Demobilization", _("Disarmament & Demobilization")),
    ("Environment", _("Environment")),
    ("Private sector", _("Private sector")),
    ("Humanitarian - Coordination / Information Management", _("Humanitarian - Coordination / Information Management")),
    ("Humanitarian - Multiple Clusters", _("Humanitarian - Multiple Clusters")),
    ("Humanitarian - Camp Management & Coordination", _("Humanitarian - Camp Management & Coordination")),
    ("Humanitarian - Early Recovery", _("Humanitarian - Early Recovery")),
    ("Humanitarian - Education", _("Humanitarian - Education")),
    ("Humanitarian - Emergency Shelter", _("Humanitarian - Emergency Shelter")),
    ("Humanitarian - Emergency Telecoms", _("Humanitarian - Emergency Telecoms")),
    ("Humanitarian - Food Security", _("Humanitarian - Food Security")),
    ("Humanitarian - Health", _("Humanitarian - Health")),
    ("Humanitarian - Logistics", _("Humanitarian - Logistics")),
    ("Humanitarian - Nutrition", _("Humanitarian - Nutrition")),
    ("Humanitarian - Protection", _("Humanitarian - Protection")),
    ("Humanitarian - Sanitation, Water & Hygiene", _("Humanitarian - Sanitation, Water & Hygiene")),
    ("Other", _("Other")),
)

# You might generate such a list of countries with code like this:
#
#     #     import sys
#
#     url = 'https://www.humanitarianresponse.info/api/v1.0/locations?filter[admin_level]=0'
#     while url:
#         print('Fetching', url, file=sys.stderr)
#         response = requests.get(url)
#         j = response.json()
#         if 'next' in j:
#             url = j['next']['href']
#         else:
#             url = None
#         for d in j['data']:
#             print("({}, _({}))".format(repr(d['iso3']), repr(d['label'])))
COUNTRIES = (
    # (value, human-readable label)
    ('AFG', 'Afghanistan'),
    ('ALA', '\xc5land Islands'),
    ('ALB', 'Albania'),
    ('DZA', 'Algeria'),
    ('ASM', 'American Samoa'),
    ('AND', 'Andorra'),
    ('AGO', 'Angola'),
    ('AIA', 'Anguilla'),
    ('ATA', 'Antarctica'),
    ('ATG', 'Antigua and Barbuda'),
    ('ARG', 'Argentina'),
    ('ARM', 'Armenia'),
    ('ABW', 'Aruba'),
    ('AUS', 'Australia'),
    ('AUT', 'Austria'),
    ('AZE', 'Azerbaijan'),
    ('BHS', 'Bahamas'),
    ('BHR', 'Bahrain'),
    ('BGD', 'Bangladesh'),
    ('BRB', 'Barbados'),
    ('BLR', 'Belarus'),
    ('BEL', 'Belgium'),
    ('BLZ', 'Belize'),
    ('BEN', 'Benin'),
    ('BMU', 'Bermuda'),
    ('BTN', 'Bhutan'),
    ('BOL', 'Bolivia, Plurinational State of'),
    ('BIH', 'Bosnia and Herzegovina'),
    ('BES', 'Bonaire, Sint Eustatius and Saba'),
    ('BWA', 'Botswana'),
    ('BVT', 'Bouvet Island'),
    ('BRA', 'Brazil'),
    ('IOT', 'British Indian Ocean Territory'),
    ('BRN', 'Brunei Darussalam'),
    ('BGR', 'Bulgaria'),
    ('BFA', 'Burkina Faso'),
    ('BDI', 'Burundi'),
    ('KHM', 'Cambodia'),
    ('CMR', 'Cameroon'),
    ('CAN', 'Canada'),
    ('CPV', 'Cape Verde'),
    ('CYM', 'Cayman Islands'),
    ('CAF', 'Central African Republic'),
    ('TCD', 'Chad'),
    ('CHL', 'Chile'),
    ('CHN', 'China'),
    ('CXR', 'Christmas Island'),
    ('CCK', 'Cocos (Keeling) Islands'),
    ('COL', 'Colombia'),
    ('COM', 'Comoros'),
    ('COG', 'Congo'),
    ('COD', 'Congo, The Democratic Republic of the'),
    ('COK', 'Cook Islands'),
    ('CRI', 'Costa Rica'),
    ('CIV', "C\xf4te d'Ivoire"),
    ('HRV', 'Croatia'),
    ('CUB', 'Cuba'),
    ('CUW', 'Cura\xe7ao'),
    ('CYP', 'Cyprus'),
    ('CZE', 'Czech Republic'),
    ('DNK', 'Denmark'),
    ('DJI', 'Djibouti'),
    ('DMA', 'Dominica'),
    ('DOM', 'Dominican Republic'),
    ('ECU', 'Ecuador'),
    ('EGY', 'Egypt'),
    ('SLV', 'El Salvador'),
    ('GNQ', 'Equatorial Guinea'),
    ('ERI', 'Eritrea'),
    ('EST', 'Estonia'),
    ('ETH', 'Ethiopia'),
    ('FLK', 'Falkland Islands (Malvinas)'),
    ('FRO', 'Faroe Islands'),
    ('FJI', 'Fiji'),
    ('FIN', 'Finland'),
    ('FRA', 'France'),
    ('GUF', 'French Guiana'),
    ('PYF', 'French Polynesia'),
    ('ATF', 'French Southern Territories'),
    ('GAB', 'Gabon'),
    ('GMB', 'Gambia'),
    ('GEO', 'Georgia'),
    ('DEU', 'Germany'),
    ('GHA', 'Ghana'),
    ('GIB', 'Gibraltar'),
    ('GRC', 'Greece'),
    ('GRL', 'Greenland'),
    ('GRD', 'Grenada'),
    ('GLP', 'Guadeloupe'),
    ('GUM', 'Guam'),
    ('GTM', 'Guatemala'),
    ('GGY', 'Guernsey'),
    ('GIN', 'Guinea'),
    ('GNB', 'Guinea-Bissau'),
    ('GUY', 'Guyana'),
    ('HTI', 'Haiti'),
    ('HMD', 'Heard Island and McDonald Islands'),
    ('VAT', 'Holy See (Vatican City State)'),
    ('HND', 'Honduras'),
    ('HKG', 'Hong Kong'),
    ('HUN', 'Hungary'),
    ('ISL', 'Iceland'),
    ('IND', 'India'),
    ('IDN', 'Indonesia'),
    ('IRN', 'Iran, Islamic Republic of'),
    ('IRQ', 'Iraq'),
    ('IRL', 'Ireland'),
    ('IMN', 'Isle of Man'),
    ('ISR', 'Israel'),
    ('ITA', 'Italy'),
    ('JAM', 'Jamaica'),
    ('JPN', 'Japan'),
    ('JEY', 'Jersey'),
    ('JOR', 'Jordan'),
    ('KAZ', 'Kazakhstan'),
    ('KEN', 'Kenya'),
    ('KIR', 'Kiribati'),
    ('PRK', "Korea, Democratic People's Republic of"),
    ('KOR', 'Korea, Republic of'),
    ('KWT', 'Kuwait'),
    ('KGZ', 'Kyrgyzstan'),
    ('LAO', "Lao People's Democratic Republic"),
    ('LVA', 'Latvia'),
    ('LBN', 'Lebanon'),
    ('LSO', 'Lesotho'),
    ('LBR', 'Liberia'),
    ('LBY', 'Libya'),
    ('LIE', 'Liechtenstein'),
    ('LTU', 'Lithuania'),
    ('LUX', 'Luxembourg'),
    ('MAC', 'Macao'),
    ('MKD', 'Macedonia, The Former Yugoslav Republic of'),
    ('MDG', 'Madagascar'),
    ('MWI', 'Malawi'),
    ('MYS', 'Malaysia'),
    ('MDV', 'Maldives'),
    ('MLI', 'Mali'),
    ('MLT', 'Malta'),
    ('MHL', 'Marshall Islands'),
    ('MTQ', 'Martinique'),
    ('MRT', 'Mauritania'),
    ('MUS', 'Mauritius'),
    ('MYT', 'Mayotte'),
    ('MEX', 'Mexico'),
    ('FSM', 'Micronesia, Federated States of'),
    ('MDA', 'Moldova, Republic of'),
    ('MCO', 'Monaco'),
    ('MNG', 'Mongolia'),
    ('MNE', 'Montenegro'),
    ('MSR', 'Montserrat'),
    ('MAR', 'Morocco'),
    ('MOZ', 'Mozambique'),
    ('MMR', 'Myanmar'),
    ('NAM', 'Namibia'),
    ('NRU', 'Nauru'),
    ('NPL', 'Nepal'),
    ('NLD', 'Netherlands'),
    ('ANT', 'Netherlands Antilles'),
    ('NCL', 'New Caledonia'),
    ('NZL', 'New Zealand'),
    ('NIC', 'Nicaragua'),
    ('NER', 'Niger'),
    ('NGA', 'Nigeria'),
    ('NIU', 'Niue'),
    ('NFK', 'Norfolk Island'),
    ('MNP', 'Northern Mariana Islands'),
    ('NOR', 'Norway'),
    ('OMN', 'Oman'),
    ('PAK', 'Pakistan'),
    ('PLW', 'Palau'),
    ('PSE', 'occupied Palestinian territory'),
    ('PAN', 'Panama'),
    ('PNG', 'Papua New Guinea'),
    ('PRY', 'Paraguay'),
    ('PER', 'Peru'),
    ('PHL', 'Philippines'),
    ('PCN', 'Pitcairn'),
    ('POL', 'Poland'),
    ('PRT', 'Portugal'),
    ('PRI', 'Puerto Rico'),
    ('QAT', 'Qatar'),
    ('REU', 'R\xe9union'),
    ('ROU', 'Romania'),
    ('RUS', 'Russian Federation'),
    ('RWA', 'Rwanda'),
    ('BLM', 'Saint Barth\xe9lemy'),
    ('SHN', 'Saint Helena, Ascension and Tristan da Cunha'),
    ('KNA', 'Saint Kitts and Nevis'),
    ('LCA', 'Saint Lucia'),
    ('MAF', 'Saint Martin (French part)'),
    ('SPM', 'Saint Pierre and Miquelon'),
    ('VCT', 'Saint Vincent and the Grenadines'),
    ('WSM', 'Samoa'),
    ('SMR', 'San Marino'),
    ('STP', 'S\xe3o Tom\xe9 and Pr\xedncipe'),
    ('SAU', 'Saudi Arabia'),
    ('SEN', 'Senegal'),
    ('SRB', 'Serbia'),
    ('SYC', 'Seychelles'),
    ('SLE', 'Sierra Leone'),
    ('SGP', 'Singapore'),
    ('SXM', 'Sint Maarten (Dutch part)'),
    ('SVK', 'Slovakia'),
    ('SVN', 'Slovenia'),
    ('SLB', 'Solomon Islands'),
    ('SOM', 'Somalia'),
    ('ZAF', 'South Africa'),
    ('SGS', 'South Georgia and the South Sandwich Islands'),
    ('ESP', 'Spain'),
    ('LKA', 'Sri Lanka'),
    ('SSD', 'South Sudan'),
    ('SDN', 'Sudan'),
    ('SUR', 'Suriname'),
    ('SJM', 'Svalbard and Jan Mayen'),
    ('SWZ', 'Swaziland'),
    ('SWE', 'Sweden'),
    ('CHE', 'Switzerland'),
    ('SYR', 'Syrian Arab Republic'),
    ('TWN', 'Taiwan, Province of China'),
    ('TJK', 'Tajikistan'),
    ('TZA', 'Tanzania, United Republic of'),
    ('THA', 'Thailand'),
    ('TLS', 'Timor-Leste'),
    ('TGO', 'Togo'),
    ('TKL', 'Tokelau'),
    ('TON', 'Tonga'),
    ('TTO', 'Trinidad and Tobago'),
    ('TUN', 'Tunisia'),
    ('TUR', 'Turkey'),
    ('TKM', 'Turkmenistan'),
    ('TCA', 'Turks and Caicos Islands'),
    ('TUV', 'Tuvalu'),
    ('UGA', 'Uganda'),
    ('UKR', 'Ukraine'),
    ('ARE', 'United Arab Emirates'),
    ('GBR', 'United Kingdom'),
    ('USA', 'United States'),
    ('UMI', 'United States Minor Outlying Islands'),
    ('URY', 'Uruguay'),
    ('UZB', 'Uzbekistan'),
    ('VUT', 'Vanuatu'),
    ('VEN', 'Venezuela, Bolivarian Republic of'),
    ('VNM', 'Viet Nam'),
    ('VGB', 'Virgin Islands, British'),
    ('VIR', 'Virgin Islands, U.S.'),
    ('WLF', 'Wallis and Futuna'),
    ('ESH', 'Western Sahara'),
    ('YEM', 'Yemen'),
    ('ZMB', 'Zambia'),
    ('ZWE', 'Zimbabwe'),
)

# You might generate such a list of languages with code like this:
#
#     import requests
#     url = 'http://loc.gov/standards/iso639-2/ISO-639-2_utf-8.txt'
#     response = requests.get(url)
#     for line in response.iter_lines():
#         # Wow, the LOC does not specify an encoding in the response!
#         line = line.decode(response.apparent_encoding)
#         fields = line.strip().split('|')
#         if fields[2]:
#             print '({}, _({})),'.format(repr(fields[2]), repr(fields[3]))
LANGUAGES = (
    # (value, human-readable label)
    ('aa', 'Afar'),
    ('ab', 'Abkhazian'),
    ('af', 'Afrikaans'),
    ('ak', 'Akan'),
    ('sq', 'Albanian'),
    ('am', 'Amharic'),
    ('ar', 'Arabic'),
    ('an', 'Aragonese'),
    ('hy', 'Armenian'),
    ('as', 'Assamese'),
    ('av', 'Avaric'),
    ('ae', 'Avestan'),
    ('ay', 'Aymara'),
    ('az', 'Azerbaijani'),
    ('ba', 'Bashkir'),
    ('bm', 'Bambara'),
    ('eu', 'Basque'),
    ('be', 'Belarusian'),
    ('bn', 'Bengali'),
    ('bh', 'Bihari languages'),
    ('bi', 'Bislama'),
    ('bs', 'Bosnian'),
    ('br', 'Breton'),
    ('bg', 'Bulgarian'),
    ('my', 'Burmese'),
    ('ca', 'Catalan; Valencian'),
    ('ch', 'Chamorro'),
    ('ce', 'Chechen'),
    ('zh', 'Chinese'),
    ('cu', 'Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic'),
    ('cv', 'Chuvash'),
    ('kw', 'Cornish'),
    ('co', 'Corsican'),
    ('cr', 'Cree'),
    ('cs', 'Czech'),
    ('da', 'Danish'),
    ('dv', 'Divehi; Dhivehi; Maldivian'),
    ('nl', 'Dutch; Flemish'),
    ('dz', 'Dzongkha'),
    ('en', 'English'),
    ('eo', 'Esperanto'),
    ('et', 'Estonian'),
    ('ee', 'Ewe'),
    ('fo', 'Faroese'),
    ('fj', 'Fijian'),
    ('fi', 'Finnish'),
    ('fr', 'French'),
    ('fy', 'Western Frisian'),
    ('ff', 'Fulah'),
    ('ka', 'Georgian'),
    ('de', 'German'),
    ('gd', 'Gaelic; Scottish Gaelic'),
    ('ga', 'Irish'),
    ('gl', 'Galician'),
    ('gv', 'Manx'),
    ('el', 'Greek, Modern (1453-)'),
    ('gn', 'Guarani'),
    ('gu', 'Gujarati'),
    ('ht', 'Haitian; Haitian Creole'),
    ('ha', 'Hausa'),
    ('he', 'Hebrew'),
    ('hz', 'Herero'),
    ('hi', 'Hindi'),
    ('ho', 'Hiri Motu'),
    ('hr', 'Croatian'),
    ('hu', 'Hungarian'),
    ('ig', 'Igbo'),
    ('is', 'Icelandic'),
    ('io', 'Ido'),
    ('ii', 'Sichuan Yi; Nuosu'),
    ('iu', 'Inuktitut'),
    ('ie', 'Interlingue; Occidental'),
    ('ia', 'Interlingua (International Auxiliary Language Association)'),
    ('id', 'Indonesian'),
    ('ik', 'Inupiaq'),
    ('it', 'Italian'),
    ('jv', 'Javanese'),
    ('ja', 'Japanese'),
    ('kl', 'Kalaallisut; Greenlandic'),
    ('kn', 'Kannada'),
    ('ks', 'Kashmiri'),
    ('kr', 'Kanuri'),
    ('kk', 'Kazakh'),
    ('km', 'Central Khmer'),
    ('ki', 'Kikuyu; Gikuyu'),
    ('rw', 'Kinyarwanda'),
    ('ky', 'Kirghiz; Kyrgyz'),
    ('kv', 'Komi'),
    ('kg', 'Kongo'),
    ('ko', 'Korean'),
    ('kj', 'Kuanyama; Kwanyama'),
    ('ku', 'Kurdish'),
    ('lo', 'Lao'),
    ('la', 'Latin'),
    ('lv', 'Latvian'),
    ('li', 'Limburgan; Limburger; Limburgish'),
    ('ln', 'Lingala'),
    ('lt', 'Lithuanian'),
    ('lb', 'Luxembourgish; Letzeburgesch'),
    ('lu', 'Luba-Katanga'),
    ('lg', 'Ganda'),
    ('mk', 'Macedonian'),
    ('mh', 'Marshallese'),
    ('ml', 'Malayalam'),
    ('mi', 'Maori'),
    ('mr', 'Marathi'),
    ('ms', 'Malay'),
    ('mg', 'Malagasy'),
    ('mt', 'Maltese'),
    ('mn', 'Mongolian'),
    ('na', 'Nauru'),
    ('nv', 'Navajo; Navaho'),
    ('nr', 'Ndebele, South; South Ndebele'),
    ('nd', 'Ndebele, North; North Ndebele'),
    ('ng', 'Ndonga'),
    ('ne', 'Nepali'),
    ('nn', 'Norwegian Nynorsk; Nynorsk, Norwegian'),
    ('nb', 'Bokm\xe5l, Norwegian; Norwegian Bokm\xe5l'),
    ('no', 'Norwegian'),
    ('ny', 'Chichewa; Chewa; Nyanja'),
    ('oc', 'Occitan (post 1500); Proven\xe7al'),
    ('oj', 'Ojibwa'),
    ('or', 'Oriya'),
    ('om', 'Oromo'),
    ('os', 'Ossetian; Ossetic'),
    ('pa', 'Panjabi; Punjabi'),
    ('fa', 'Persian'),
    ('pi', 'Pali'),
    ('pl', 'Polish'),
    ('pt', 'Portuguese'),
    ('ps', 'Pushto; Pashto'),
    ('qu', 'Quechua'),
    ('rm', 'Romansh'),
    ('ro', 'Romanian; Moldavian; Moldovan'),
    ('rn', 'Rundi'),
    ('ru', 'Russian'),
    ('sg', 'Sango'),
    ('sa', 'Sanskrit'),
    ('si', 'Sinhala; Sinhalese'),
    ('sk', 'Slovak'),
    ('sl', 'Slovenian'),
    ('se', 'Northern Sami'),
    ('sm', 'Samoan'),
    ('sn', 'Shona'),
    ('sd', 'Sindhi'),
    ('so', 'Somali'),
    ('st', 'Sotho, Southern'),
    ('es', 'Spanish; Castilian'),
    ('sc', 'Sardinian'),
    ('sr', 'Serbian'),
    ('ss', 'Swati'),
    ('su', 'Sundanese'),
    ('sw', 'Swahili'),
    ('sv', 'Swedish'),
    ('ty', 'Tahitian'),
    ('ta', 'Tamil'),
    ('tt', 'Tatar'),
    ('te', 'Telugu'),
    ('tg', 'Tajik'),
    ('tl', 'Tagalog'),
    ('th', 'Thai'),
    ('bo', 'Tibetan'),
    ('ti', 'Tigrinya'),
    ('to', 'Tonga (Tonga Islands)'),
    ('tn', 'Tswana'),
    ('ts', 'Tsonga'),
    ('tk', 'Turkmen'),
    ('tr', 'Turkish'),
    ('tw', 'Twi'),
    ('ug', 'Uighur; Uyghur'),
    ('uk', 'Ukrainian'),
    ('ur', 'Urdu'),
    ('uz', 'Uzbek'),
    ('ve', 'Venda'),
    ('vi', 'Vietnamese'),
    ('vo', 'Volap\xfck'),
    ('cy', 'Welsh'),
    ('wa', 'Walloon'),
    ('wo', 'Wolof'),
    ('xh', 'Xhosa'),
    ('yi', 'Yiddish'),
    ('yo', 'Yoruba'),
    ('za', 'Zhuang; Chuang'),
    ('zu', 'Zulu'),
)

# Whenever we add a translation that Django itself does not support, add
# information about the language here. This dictionary will be used to update
# `django.conf.locale.LANG_INFO`
EXTRA_LANG_INFO = {
    'ku': {
        'bidi': True,
        'code': 'ku',
        'name': 'Kurdish',
        'name_local': 'كوردی',
    },
}


transcription_languages = {
  "af-ZA": {
    "name": "Afrikaans (South Africa)",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  "sq-AL": {
    "name": "Albanian (Albania)",
    "options": [
      "Google"
    ]
  },
  "am-ET": {
    "name": "Amharic (Ethiopia)",
    "options": [
      "Google"
    ]
  },
  "ar-DZ": {
    "name": "Arabic (Algeria)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-BH": {
    "name": "Arabic (Bahrain)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-EG": {
    "name": "Arabic (Egypt)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-IQ": {
    "name": "Arabic (Iraq)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-IL": {
    "name": "Arabic (Israel)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-JO": {
    "name": "Arabic (Jordan)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-KW": {
    "name": "Arabic (Kuwait)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-LB": {
    "name": "Arabic (Lebanon)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-LY": {
    "name": "Arabic (Libya)",
    "options": [
      "Microsoft"
    ]
  },
  "ar-MA": {
    "name": "Arabic (Morocco)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-OM": {
    "name": "Arabic (Oman)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-QA": {
    "name": "Arabic (Qatar)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-SA": {
    "name": "Arabic (Saudi Arabia)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ar-PS": {
    "name": "Arabic (State of Palestine)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-TN": {
    "name": "Arabic (Tunisia)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ar-AE": {
    "name": "Arabic (United Arab Emirates)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ar-YE": {
    "name": "Arabic (Yemen)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "hy-AM": {
    "name": "Armenian (Armenia)",
    "options": [
      "Google"
    ]
  },
  "az-AZ": {
    "name": "Azerbaijani (Azerbaijan)",
    "options": [
      "Google"
    ]
  },
  "eu-ES": {
    "name": "Basque (Spain)",
    "options": [
      "Google"
    ]
  },
  "bn-BD": {
    "name": "Bengali (Bangladesh)",
    "options": [
      "Google"
    ]
  },
  "bn-IN": {
    "name": "Bengali (India)",
    "options": [
      "Google"
    ]
  },
  "bs-BA": {
    "name": "Bosnian (Bosnia and Herzegovina)",
    "options": [
      "Google"
    ]
  },
  "bg-BG": {
    "name": "Bulgarian (Bulgaria)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "my-MM": {
    "name": "Burmese (Myanmar)",
    "options": [
      "Google"
    ]
  },
  "ca-ES": {
    "name": "Catalan (Spain)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "yue-Hant-HK": {
    "name": "Chinese, Cantonese (Traditional Hong Kong)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "zh": {
    "name": "Chinese, Mandarin (Simplified, China)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "zh-TW": {
    "name": "Chinese, Mandarin (Traditional, Taiwan)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "hr-HR": {
    "name": "Croatian (Croatia)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "cs-CZ": {
    "name": "Czech (Czech Republic)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "da-DK": {
    "name": "Danish (Denmark)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "nl-BE": {
    "name": "Dutch (Belgium)",
    "options": [
      "Google",
      "IBM"
    ]
  },
  "nl-NL": {
    "name": "Dutch (Netherlands)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "en-AU": {
    "name": "English (Australia)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "en-CA": {
    "name": "English (Canada)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-GH": {
    "name": "English (Ghana)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-HK": {
    "name": "English (Hong Kong)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-IN": {
    "name": "English (India)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "en-IE": {
    "name": "English (Ireland)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "en-KE": {
    "name": "English (Kenya)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-NZ": {
    "name": "English (New Zealand)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "en-NG": {
    "name": "English (Nigeria)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-PK": {
    "name": "English (Pakistan)",
    "options": [
      "Google"
    ]
  },
  "en-PH": {
    "name": "English (Philippines)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-AB": {
    "name": "English (Scottish)",
    "options": [
      "Amazon"
    ]
  },
  "en-SG": {
    "name": "English (Singapore)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-ZA": {
    "name": "English (South Africa)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "en-TZ": {
    "name": "English (Tanzania)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "en-GB": {
    "name": "English (United Kingdom)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "en-US": {
    "name": "English (United States)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft",
      "TWB"
    ]
  },
  "en-WL": {
    "name": "English (Welsh)",
    "options": [
      "Amazon"
    ]
  },
  "et-EE": {
    "name": "Estonian (Estonia)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "fil-PH": {
    "name": "Filipino (Philippines)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "fi-FI": {
    "name": "Finnish (Finland)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "fr-BE": {
    "name": "French (Belgium)",
    "options": [
      "Google"
    ]
  },
  "fr-CA": {
    "name": "French (Canada)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "fr-FR": {
    "name": "French (France)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft",
      "TWB"
    ]
  },
  "fr-CH": {
    "name": "French (Switzerland)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "gl-ES": {
    "name": "Galician (Spain)",
    "options": [
      "Google"
    ]
  },
  "ka-GE": {
    "name": "Georgian (Georgia)",
    "options": [
      "Google"
    ]
  },
  "de-AT": {
    "name": "German (Austria)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "de-DE": {
    "name": "German (Germany)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "de-CH": {
    "name": "German (Switzerland)",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  "el-GR": {
    "name": "Greek (Greece)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "gu-IN": {
    "name": "Gujarati (India)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "iw-IL": {
    "name": "Hebrew (Israel)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "hi-IN": {
    "name": "Hindi (India)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "hu-HU": {
    "name": "Hungarian (Hungary)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "is-IS": {
    "name": "Icelandic (Iceland)",
    "options": [
      "Google"
    ]
  },
  "id-ID": {
    "name": "Indonesian (Indonesia)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ge-IE": {
    "name": "Irish (Ireland)",
    "options": [
      "Microsoft"
    ]
  },
  "it-IT": {
    "name": "Italian (Italy)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "it-CH": {
    "name": "Italian (Switzerland)",
    "options": [
      "Google"
    ]
  },
  "ja-JP": {
    "name": "Japanese (Japan)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "jv-ID": {
    "name": "Javanese (Indonesia)",
    "options": [
      "Google"
    ]
  },
  "kn-IN": {
    "name": "Kannada (India)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "kk-KZ": {
    "name": "Kazakh (Kazakhstan)",
    "options": [
      "Google"
    ]
  },
  "km-KH": {
    "name": "Khmer (Cambodia)",
    "options": [
      "Google"
    ]
  },
  "ko-KR": {
    "name": "Korean (South Korea)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "lo-LA": {
    "name": "Lao (Laos)",
    "options": [
      "Google"
    ]
  },
  "lv-LV": {
    "name": "Latvian (Latvia)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "lt-LT": {
    "name": "Lithuanian (Lithuania)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "mk-MK": {
    "name": "Macedonian (North Macedonia)",
    "options": [
      "Google"
    ]
  },
  "ms-MY": {
    "name": "Malay (Malaysia)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ml-IN": {
    "name": "Malayalam (India)",
    "options": [
      "Google"
    ]
  },
  "mt-IN": {
    "name": "Maltese (Malta)",
    "options": [
      "Microsoft"
    ]
  },
  "mr-IN": {
    "name": "Marathi (India)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "mn-MN": {
    "name": "Mongolian (Mongolia)",
    "options": [
      "Google"
    ]
  },
  "ne-NP": {
    "name": "Nepali (Nepal)",
    "options": [
      "Google"
    ]
  },
  "no-NO": {
    "name": "Norwegian Bokmål (Norway)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "fa-IR": {
    "name": "Persian (Iran)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "pl-PL": {
    "name": "Polish (Poland)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "pt-BR": {
    "name": "Portuguese (Brazil)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "pt-PT": {
    "name": "Portuguese (Portugal)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "pa-Guru-IN": {
    "name": "Punjabi (Gurmukhi India)",
    "options": [
      "Google"
    ]
  },
  "ro-RO": {
    "name": "Romanian (Romania)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ru-RU": {
    "name": "Russian (Russia)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "sr-RS": {
    "name": "Serbian (Serbia)",
    "options": [
      "Google"
    ]
  },
  "si-LK": {
    "name": "Sinhala (Sri Lanka)",
    "options": [
      "Google"
    ]
  },
  "sk-SK": {
    "name": "Slovak (Slovakia)",
    "options": [
      "Google"
    ]
  },
  "sl-SI": {
    "name": "Slovenian (Slovenia)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-AR": {
    "name": "Spanish (Argentina)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "es-BO": {
    "name": "Spanish (Bolivia)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-CL": {
    "name": "Spanish (Chile)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "es-CO": {
    "name": "Spanish (Colombia)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "es-CR": {
    "name": "Spanish (Costa Rica)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-DO": {
    "name": "Spanish (Dominican Republic)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-EC": {
    "name": "Spanish (Ecuador)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-SV": {
    "name": "Spanish (El Salvador)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-GT": {
    "name": "Spanish (Guatemala)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-HN": {
    "name": "Spanish (Honduras)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-MX": {
    "name": "Spanish (Mexico)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "es-NI": {
    "name": "Spanish (Nicaragua)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-PA": {
    "name": "Spanish (Panama)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-PY": {
    "name": "Spanish (Paraguay)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-PE": {
    "name": "Spanish (Peru)",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "es-PR": {
    "name": "Spanish (Puerto Rico)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-ES": {
    "name": "Spanish (Spain)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "es-US": {
    "name": "Spanish (United States)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "es-UY": {
    "name": "Spanish (Uruguay)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "es-VE": {
    "name": "Spanish (Venezuela)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "su-ID": {
    "name": "Sundanese (Indonesia)",
    "options": [
      "Google"
    ]
  },
  "sw-cd": {
    "name": "Swahili (Congo)",
    "options": [
      "TWB"
    ]
  },
  "sw-KE": {
    "name": "Swahili (Kenya)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "sw-TZ": {
    "name": "Swahili (Tanzania)",
    "options": [
      "Google"
    ]
  },
  "sv-SE": {
    "name": "Swedish (Sweden)",
    "options": [
      "Google"
    ]
  },
  "ta-IN": {
    "name": "Tamil (India)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ta-MY": {
    "name": "Tamil (Malaysia)",
    "options": [
      "Google"
    ]
  },
  "ta-SG": {
    "name": "Tamil (Singapore)",
    "options": [
      "Google"
    ]
  },
  "ta-LK": {
    "name": "Tamil (Sri Lanka)",
    "options": [
      "Google"
    ]
  },
  "te-IN": {
    "name": "Telugu (India)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "th-TH": {
    "name": "Thai (Thailand)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "tr-TR": {
    "name": "Turkish (Turkey)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "uk-UA": {
    "name": "Ukrainian (Ukraine)",
    "options": [
      "Google"
    ]
  },
  "ur-IN": {
    "name": "Urdu (India)",
    "options": [
      "Google"
    ]
  },
  "ur-PK": {
    "name": "Urdu (Pakistan)",
    "options": [
      "Google"
    ]
  },
  "uz-UZ": {
    "name": "Uzbek (Uzbekistan)",
    "options": [
      "Google"
    ]
  },
  "vi-VN": {
    "name": "Vietnamese (Vietnam)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "zu-ZA": {
    "name": "Zulu (South Africa)",
    "options": [
      "Google"
    ]
  }
}

translation_languages = {
  "af": {
    "name": "Afrikaans",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "sq": {
    "name": "Albanian",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "am": {
    "name": "Amharic",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ar": {
    "name": "Arabic",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "hy": {
    "name": "Armenian",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "as": {
    "name": "Assamese",
    "options": [
      "Microsoft"
    ]
  },
  "az": {
    "name": "Azerbaijani",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "bn": {
    "name": "Bengali",
    "options": [
      "Google",
      "Amazon",
      "IBM"
    ]
  },
  "ba": {
    "name": "Bashkir",
    "options": [
      "Microsoft"
    ]
  },
  "eu": {
    "name": "Basque",
    "options": [
      "Google",
      "IBM"
    ]
  },
  "be": {
    "name": "Belarusian",
    "options": [
      "Google"
    ]
  },
  "bs": {
    "name": "Bosnian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "bg": {
    "name": "Bulgarian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "yue": {
    "name": "Cantonese",
    "options": [
      "Microsoft"
    ]
  },
  "ca": {
    "name": "Catalan",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ceb": {
    "name": "Cebuano",
    "options": [
      "Google"
    ]
  },
  "zh": {
    "name": "Chinese (Simplified)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ],
    "alternate_code": "zh-Hans"
  },
  "zh-TW": {
    "name": "Chinese (Traditional)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ],
    "alternate_code": "zh-Hant"
  },
  "co": {
    "name": "Corsican",
    "options": [
      "Google"
    ]
  },
  "hr": {
    "name": "Croatian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "cs": {
    "name": "Czech",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ],
    "alternate_code": "prs"
  },
  "fa-Af": {
    "name": "Dari",
    "options": [
      "Amazon",
      "Microsoft"
    ]
  },
  "da": {
    "name": "Danish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "dv": {
    "name": "Divehi"
  },
  "nl": {
    "name": "Dutch",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "en": {
    "name": "English",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "eo": {
    "name": "Esperanto",
    "options": [
      "Google"
    ]
  },
  "et": {
    "name": "Estonian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "fj": {
    "name": "Fijian",
    "options": [
      "Microsoft"
    ]
  },
  "fi": {
    "name": "Finnish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "fr": {
    "name": "French",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "fr-CA": {
    "name": "French (Canada)",
    "options": [
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "fy": {
    "name": "Frisian",
    "options": [
      "Google"
    ]
  },
  "gl": {
    "name": "Galician",
    "options": [
      "Google"
    ]
  },
  "ka": {
    "name": "Georgian",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "de": {
    "name": "German",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "el": {
    "name": "Greek",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "gu": {
    "name": "Gujarati",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ht": {
    "name": "Haitian Creole",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ha": {
    "name": "Hausa",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  "haw": {
    "name": "Hawaiian",
    "options": [
      "Google"
    ]
  },
  "he": {
    "name": "Hebrew",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "hi": {
    "name": "Hindi",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "hmn": {
    "name": "Hmong",
    "options": [
      "Google",
      "Microsoft"
    ],
    "alternate_code": "mww"
  },
  "hu": {
    "name": "Hungarian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "is": {
    "name": "Icelandic",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "ig": {
    "name": "Igbo",
    "options": [
      "Google"
    ]
  },
  "id": {
    "name": "Indonesian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "iu": {
    "name": "Inuktitut",
    "options": [
      "Microsoft"
    ]
  },
  "ga": {
    "name": "Irish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "it": {
    "name": "Italian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ja": {
    "name": "Japanese",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "jv": {
    "name": "Javanese",
    "options": [
      "Google"
    ]
  },
  "kn": {
    "name": "Kannada",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "kk": {
    "name": "Kazakh",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "km": {
    "name": "Khmer",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "rw": {
    "name": "Kinyarwanda",
    "options": [
      "Google"
    ]
  },
  "ko": {
    "name": "Korean",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ku": {
    "name": "Kurdish",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "kmr": {
    "name": "Kurdish (Northern)",
    "options": [
      "Microsoft"
    ]
  },
  "ky": {
    "name": "Kyrgyz",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "lo": {
    "name": "Lao",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "lv": {
    "name": "Latvian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "lt": {
    "name": "Lithuanian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "lb": {
    "name": "Luxembourgish",
    "options": [
      "Google"
    ]
  },
  "mk": {
    "name": "Macedonian",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "mg": {
    "name": "Malagasy",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ms": {
    "name": "Malay",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ml": {
    "name": "Malayalam",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "mt": {
    "name": "Maltese",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "mi": {
    "name": "Maori",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "mr": {
    "name": "Marathi",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "mn": {
    "name": "Mongolian",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  "mn-Cyrl": {
    "name": "Mongolian (Cyrillic)",
    "options": [
      "Microsoft"
    ]
  },
  "mn-Mong": {
    "name": "Mongolian (Traditional)",
    "options": [
      "Microsoft"
    ]
  },
  "cnr": {
    "name": "Montenegrin",
    "options": [
      "IBM"
    ]
  },
  "my": {
    "name": "Myanmar (Burmese)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ne": {
    "name": "Nepali",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  "no": {
    "name": "Norwegian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ny": {
    "name": "Nyanja (Chichewa)",
    "options": [
      "Google"
    ]
  },
  "or": {
    "name": "Odia (Oriya)",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "ps": {
    "name": "Pashto",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "fa": {
    "name": "Persian",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "pl": {
    "name": "Polish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "pt": {
    "name": "Portuguese (Portugal, Brazil)",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "pt-pt": {
    "name": "Portuguese (Portugal)",
    "options": [
      "Microsoft"
    ]
  },
  "pa": {
    "name": "Punjabi",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "otq": {
    "name": "Queretaru Otomi",
    "options": [
      "Microsoft"
    ]
  },
  "ro": {
    "name": "Romanian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ru": {
    "name": "Russian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "sm": {
    "name": "Samoan",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "gd": {
    "name": "Scots Gaelic",
    "options": [
      "Google"
    ]
  },
  "sr": {
    "name": "Serbian",
    "options": [
      "Google",
      "Amazon",
      "IBM"
    ]
  },
  "sr-Cyrl": {
    "name": "Serbian (Cryllic)",
    "options": [
      "Microsoft"
    ]
  },
  "sr-Latn": {
    "name": "Serbian (Latin)",
    "options": [
      "Microsoft"
    ]
  },
  "st": {
    "name": "Sesotho",
    "options": [
      "Google"
    ]
  },
  "sn": {
    "name": "Shona",
    "options": [
      "Google"
    ]
  },
  "sd": {
    "name": "Sindhi",
    "options": [
      "Google"
    ]
  },
  "si": {
    "name": "Sinhala (Sinhalese)",
    "options": [
      "Google",
      "Amazon",
      "IBM"
    ]
  },
  "sk": {
    "name": "Slovak",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "sl": {
    "name": "Slovenian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "so": {
    "name": "Somali",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  "es": {
    "name": "Spanish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "su": {
    "name": "Sundanese",
    "options": [
      "Google"
    ]
  },
  "sw": {
    "name": "Swahili",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "sv": {
    "name": "Swedish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "tl": {
    "name": "Tagalog (Filipino)",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ],
    "alternate_code": "fil"
  },
  "tg": {
    "name": "Tajik",
    "options": [
      "Google"
    ]
  },
  "ta": {
    "name": "Tamil",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "tt": {
    "name": "Tatar",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "te": {
    "name": "Telugu",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "th": {
    "name": "Thai",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "bo": {
    "name": "Tibetan",
    "options": [
      "Microsoft"
    ]
  },
  "ti": {
    "name": "Tigrinya",
    "options": [
      "Microsoft"
    ]
  },
  "tr": {
    "name": "Turkish",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "tk": {
    "name": "Turkmen",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "uk": {
    "name": "Ukrainian",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ur": {
    "name": "Urdu",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "ug": {
    "name": "Uyghur",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  "uz": {
    "name": "Uzbek",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  "vi": {
    "name": "Vietnamese",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "cy": {
    "name": "Welsh",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  "xh": {
    "name": "Xhosa",
    "options": [
      "Google"
    ]
  },
  "yi": {
    "name": "Yiddish",
    "options": [
      "Google"
    ]
  },
  "yo": {
    "name": "Yoruba",
    "options": [
      "Google"
    ]
  },
  "yua": {
    "name": "Yucatec Maya",
    "options": [
      "Microsoft"
    ]
  },
  "zu": {
    "name": "Zulu",
    "options": [
      "Google"
    ]
  }
}
