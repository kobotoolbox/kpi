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


transcription_languages = {[
  {
    "name": "Afrikaans (South Africa)",
    "language_code": "af-ZA",
    "options": ["Google", "Amazon"],
  },
  {
    "name": "Albanian (Albania)",
    "language_code": "sq-AL",
    "options": ["Google"],
  },
  {
    "name": "Amharic (Ethiopia)",
    "language_code": "am-ET",
    "options": ["Google"],
  },
  {
    "name": "Arabic (Algeria)",
    "language_code": "ar-DZ",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Bahrain)",
    "language_code": "ar-BH",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Egypt)",
    "language_code": "ar-EG",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Iraq)",
    "language_code": "ar-IQ",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Israel)",
    "language_code": "ar-IL",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Jordan)",
    "language_code": "ar-JO",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Kuwait)",
    "language_code": "ar-KW",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Lebanon)",
    "language_code": "ar-LB",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Libya)",
    "language_code": "ar-LY",
    "options": ["Microsoft"],
  },
  {
    "name": "Arabic (Morocco)",
    "language_code": "ar-MA",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Oman)",
    "language_code": "ar-OM",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Qatar)",
    "language_code": "ar-QA",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Saudi Arabia)",
    "language_code": "ar-SA",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Arabic (State of Palestine)",
    "language_code": "ar-PS",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (Tunisia)",
    "language_code": "ar-TN",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Arabic (United Arab Emirates)",
    "language_code": "ar-AE",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Arabic (Yemen)",
    "language_code": "ar-YE",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Armenian (Armenia)",
    "language_code": "hy-AM",
    "options": ["Google"],
  },
  {
    "name": "Azerbaijani (Azerbaijan)",
    "language_code": "az-AZ",
    "options": ["Google"],
  },
  {
    "name": "Basque (Spain)",
    "language_code": "eu-ES",
    "options": ["Google"],
  },
  {
    "name": "Bengali (Bangladesh)",
    "language_code": "bn-BD",
    "options": ["Google"],
  },
  {
    "name": "Bengali (India)",
    "language_code": "bn-IN",
    "options": ["Google"],
  },
  {
    "name": "Bosnian (Bosnia and Herzegovina)",
    "language_code": "bs-BA",
    "options": ["Google"],
  },
  {
    "name": "Bulgarian (Bulgaria)",
    "language_code": "bg-BG",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Burmese (Myanmar)",
    "language_code": "my-MM",
    "options": ["Google"],
  },
  {
    "name": "Catalan (Spain)",
    "language_code": "ca-ES",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Chinese, Cantonese (Traditional Hong Kong)",
    "language_code": "yue-Hant-HK",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Chinese, Mandarin (Simplified, China)",
    "language_code": "zh (cmn-Hans-CN)",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Chinese, Mandarin (Traditional, Taiwan)",
    "language_code": "zh-TW",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Croatian (Croatia)",
    "language_code": "hr-HR",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Czech (Czech Republic)",
    "language_code": "cs-CZ",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Danish (Denmark)",
    "language_code": "da-DK",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Dutch (Belgium)",
    "language_code": "nl-BE",
    "options": ["Google", "IBM"],
  },
  {
    "name": "Dutch (Netherlands)",
    "language_code": "nl-NL",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "English (Australia)",
    "language_code": "en-AU",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "English (Canada)",
    "language_code": "en-CA",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (Ghana)",
    "language_code": "en-GH",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (Hong Kong)",
    "language_code": "en-HK",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (India)",
    "language_code": "en-IN",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "English (Ireland)",
    "language_code": "en-IE",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "English (Kenya)",
    "language_code": "en-KE",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (New Zealand)",
    "language_code": "en-NZ",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "English (Nigeria)",
    "language_code": "en-NG",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (Pakistan)",
    "language_code": "en-PK",
    "options": ["Google"],
  },
  {
    "name": "English (Philippines)",
    "language_code": "en-PH",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (Scottish)",
    "language_code": "en-AB",
    "options": ["Amazon"],
  },
  {
    "name": "English (Singapore)",
    "language_code": "en-SG",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (South Africa)",
    "language_code": "en-ZA",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "English (Tanzania)",
    "language_code": "en-TZ",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "English (United Kingdom)",
    "language_code": "en-GB",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "English (United States)",
    "language_code": "en-US",
    "options": ["Google", "Amazon", "IBM", "Microsoft", "TWB"],
  },
  {
    "name": "English (Welsh)",
    "language_code": "en-WL",
    "options": ["Amazon"],
  },
  {
    "name": "Estonian (Estonia)",
    "language_code": "et-EE",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Filipino (Philippines)",
    "language_code": "fil-PH",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Finnish (Finland)",
    "language_code": "fi-FI",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "French (Belgium)",
    "language_code": "fr-BE",
    "options": ["Google"],
  },
  {
    "name": "French (Canada)",
    "language_code": "fr-CA",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "French (France)",
    "language_code": "fr-FR",
    "options": ["Google", "Amazon", "IBM", "Microsoft", "TWB"],
  },
  {
    "name": "French (Switzerland)",
    "language_code": "fr-CH",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Galician (Spain)",
    "language_code": "gl-ES",
    "options": ["Google"],
  },
  {
    "name": "Georgian (Georgia)",
    "language_code": "ka-GE",
    "options": ["Google"],
  },
  {
    "name": "German (Austria)",
    "language_code": "de-AT",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "German (Germany)",
    "language_code": "de-DE",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "German (Switzerland)",
    "language_code": "de-CH",
    "options": ["Google", "Amazon"],
  },
  {
    "name": "Greek (Greece)",
    "language_code": "el-GR",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Gujarati (India)",
    "language_code": "gu-IN",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Hebrew (Israel)",
    "language_code": "iw-IL",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Hindi (India)",
    "language_code": "hi-IN",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Hungarian (Hungary)",
    "language_code": "hu-HU",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Icelandic (Iceland)",
    "language_code": "is-IS",
    "options": ["Google"],
  },
  {
    "name": "Indonesian (Indonesia)",
    "language_code": "id-ID",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Irish (Ireland)",
    "language_code": "ge-IE",
    "options": ["Microsoft"],
  },
  {
    "name": "Italian (Italy)",
    "language_code": "it-IT",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Italian (Switzerland)",
    "language_code": "it-CH",
    "options": ["Google"],
  },
  {
    "name": "Japanese (Japan)",
    "language_code": "ja-JP",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Javanese (Indonesia)",
    "language_code": "jv-ID",
    "options": ["Google"],
  },
  {
    "name": "Kannada (India)",
    "language_code": "kn-IN",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Kazakh (Kazakhstan)",
    "language_code": "kk-KZ",
    "options": ["Google"],
  },
  {
    "name": "Khmer (Cambodia)",
    "language_code": "km-KH",
    "options": ["Google"],
  },
  {
    "name": "Korean (South Korea)",
    "language_code": "ko-KR",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Lao (Laos)",
    "language_code": "lo-LA",
    "options": ["Google"],
  },
  {
    "name": "Latvian (Latvia)",
    "language_code": "lv-LV",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Lithuanian (Lithuania)",
    "language_code": "lt-LT",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Macedonian (North Macedonia)",
    "language_code": "mk-MK",
    "options": ["Google"],
  },
  {
    "name": "Malay (Malaysia)",
    "language_code": "ms-MY",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Malayalam (India)",
    "language_code": "ml-IN",
    "options": ["Google"],
  },
  {
    "name": "Maltese (Malta)",
    "language_code": "mt-IN",
    "options": ["Microsoft"],
  },
  {
    "name": "Marathi (India)",
    "language_code": "mr-IN",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Mongolian (Mongolia)",
    "language_code": "mn-MN",
    "options": ["Google"],
  },
  {
    "name": "Nepali (Nepal)",
    "language_code": "ne-NP",
    "options": ["Google"],
  },
  {
    "name": "Norwegian Bokmål (Norway)",
    "language_code": "no-NO",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Persian (Iran)",
    "language_code": "fa-IR",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Polish (Poland)",
    "language_code": "pl-PL",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Portuguese (Brazil)",
    "language_code": "pt-BR",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Portuguese (Portugal)",
    "language_code": "pt-PT",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Punjabi (Gurmukhi India)",
    "language_code": "pa-Guru-IN",
    "options": ["Google"],
  },
  {
    "name": "Romanian (Romania)",
    "language_code": "ro-RO",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Russian (Russia)",
    "language_code": "ru-RU",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Serbian (Serbia)",
    "language_code": "sr-RS",
    "options": ["Google"],
  },
  {
    "name": "Sinhala (Sri Lanka)",
    "language_code": "si-LK",
    "options": ["Google"],
  },
  {
    "name": "Slovak (Slovakia)",
    "language_code": "sk-SK",
    "options": ["Google"],
  },
  {
    "name": "Slovenian (Slovenia)",
    "language_code": "sl-SI",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Argentina)",
    "language_code": "es-AR",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Spanish (Bolivia)",
    "language_code": "es-BO",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Chile)",
    "language_code": "es-CL",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Spanish (Colombia)",
    "language_code": "es-CO",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Spanish (Costa Rica)",
    "language_code": "es-CR",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Dominican Republic)",
    "language_code": "es-DO",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Ecuador)",
    "language_code": "es-EC",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (El Salvador)",
    "language_code": "es-SV",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Guatemala)",
    "language_code": "es-GT",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Honduras)",
    "language_code": "es-HN",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Mexico)",
    "language_code": "es-MX",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Spanish (Nicaragua)",
    "language_code": "es-NI",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Panama)",
    "language_code": "es-PA",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Paraguay)",
    "language_code": "es-PY",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Peru)",
    "language_code": "es-PE",
    "options": ["Google", "IBM", "Microsoft"],
  },
  {
    "name": "Spanish (Puerto Rico)",
    "language_code": "es-PR",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Spain)",
    "language_code": "es-ES",
    "options": ["Google", "Amazon", "IBM", "Microsoft"],
  },
  {
    "name": "Spanish (United States)",
    "language_code": "es-US",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Spanish (Uruguay)",
    "language_code": "es-UY",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Spanish (Venezuela)",
    "language_code": "es-VE",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Sundanese (Indonesia)",
    "language_code": "su-ID",
    "options": ["Google"],
  },
  {
    "name": "Swahili (Congo)",
    "language_code": "sw-cd",
    "options": ["TWB"],
  },
  {
    "name": "Swahili (Kenya)",
    "language_code": "sw-KE",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Swahili (Tanzania)",
    "language_code": "sw-TZ",
    "options": ["Google"],
  },
  {
    "name": "Swedish (Sweden)",
    "language_code": "sv-SE",
    "options": ["Google"],
  },
  {
    "name": "Tamil (India)",
    "language_code": "ta-IN",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Tamil (Malaysia)",
    "language_code": "ta-MY",
    "options": ["Google"],
  },
  {
    "name": "Tamil (Singapore)",
    "language_code": "ta-SG",
    "options": ["Google"],
  },
  {
    "name": "Tamil (Sri Lanka)",
    "language_code": "ta-LK",
    "options": ["Google"],
  },
  {
    "name": "Telugu (India)",
    "language_code": "te-IN",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Thai (Thailand)",
    "language_code": "th-TH",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Turkish (Turkey)",
    "language_code": "tr-TR",
    "options": ["Google", "Amazon", "Microsoft"],
  },
  {
    "name": "Ukrainian (Ukraine)",
    "language_code": "uk-UA",
    "options": ["Google"],
  },
  {
    "name": "Urdu (India)",
    "language_code": "ur-IN",
    "options": ["Google"],
  },
  {
    "name": "Urdu (Pakistan)",
    "language_code": "ur-PK",
    "options": ["Google"],
  },
  {
    "name": "Uzbek (Uzbekistan)",
    "language_code": "uz-UZ",
    "options": ["Google"],
  },
  {
    "name": "Vietnamese (Vietnam)",
    "language_code": "vi-VN",
    "options": ["Google", "Microsoft"],
  },
  {
    "name": "Zulu (South Africa)",
    "language_code": "zu-ZA",
    "options": ["Google"],
  }
]}

translation_languages = {[
  {
    "name": "Afrikaans",
    "language_code": "af",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Albanian",
    "language_code": "sq",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Amharic",
    "language_code": "am",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Arabic",
    "language_code": "ar",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Armenian",
    "language_code": "hy",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Assamese",
    "language_code": "as",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Azerbaijani",
    "language_code": "az",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Bangla",
    "language_code": "bn",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Bashkir",
    "language_code": "ba",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Basque",
    "language_code": "eu",
    "options": [
      "Google",
      "IBM"
    ]
  },
  {
    "name": "Belarusian",
    "language_code": "be",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Bengali",
    "language_code": "bn",
    "options": [
      "Google",
      "Amazon",
      "IBM"
    ]
  },
  {
    "name": "Bosnian",
    "language_code": "bs",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Bulgarian",
    "language_code": "bg",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Cantonese",
    "language_code": "yue",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Catalan",
    "language_code": "ca",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Cebuano",
    "language_code": "ceb (ISO-639-2)",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Chinese (Simplified)",
    "language_code": "zh",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ],
    "alternate_code": "zh-Hans"
  },
  {
    "name": "Chinese (Traditional)",
    "language_code": "zh-TW",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ],
    "alternate_code": "zh-Hant"
  },
  {
    "name": "Corsican",
    "language_code": "co",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Croatian",
    "language_code": "hr",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Czech",
    "language_code": "cs",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ],
    "alternate_code": "prs"
  },
  {
    "name": "Dari",
    "language_code": "fa-Af",
    "options": [
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Danish",
    "language_code": "da",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Divehi",
    "language_code": "dv"
  },
  {
    "name": "Dutch",
    "language_code": "nl",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "English",
    "language_code": "en",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Esperanto",
    "language_code": "eo",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Estonian",
    "language_code": "et",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Fijian",
    "language_code": "fj",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Finnish",
    "language_code": "fi",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "French",
    "language_code": "fr",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "French (Canada)",
    "language_code": "fr-CA",
    "options": [
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Frisian",
    "language_code": "fy",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Galician",
    "language_code": "gl",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Georgian",
    "language_code": "ka",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "German",
    "language_code": "de",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Greek",
    "language_code": "el",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Gujarati",
    "language_code": "gu",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Haitian Creole",
    "language_code": "ht",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Hausa",
    "language_code": "ha",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  {
    "name": "Hawaiian",
    "language_code": "haw (ISO-639-2)",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Hebrew",
    "language_code": "he or iw",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Hindi",
    "language_code": "hi",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Hmong",
    "language_code": "hmn (ISO-639-2)",
    "options": [
      "Google",
      "Microsoft"
    ],
    "alternate_code": "mww"
  },
  {
    "name": "Hungarian",
    "language_code": "hu",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Icelandic",
    "language_code": "is",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Igbo",
    "language_code": "ig",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Indonesian",
    "language_code": "id",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Inuktitut",
    "language_code": "iu",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Irish",
    "language_code": "ga",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Italian",
    "language_code": "it",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Japanese",
    "language_code": "ja",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Javanese",
    "language_code": "jv",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Kannada",
    "language_code": "kn",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Kazakh",
    "language_code": "kk",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Khmer",
    "language_code": "km",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Kinyarwanda",
    "language_code": "rw",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Korean",
    "language_code": "ko",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Kurdish",
    "language_code": "ku",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Kurdish (Northern)",
    "language_code": "kmr",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Kyrgyz",
    "language_code": "ky",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Lao",
    "language_code": "lo",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Latvian",
    "language_code": "lv",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Lithuanian",
    "language_code": "lt",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Luxembourgish",
    "language_code": "lb",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Macedonian",
    "language_code": "mk",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Malagasy",
    "language_code": "mg",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Malay",
    "language_code": "ms",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Malayalam",
    "language_code": "ml",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Maltese",
    "language_code": "mt",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Maori",
    "language_code": "mi",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Marathi",
    "language_code": "mr",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Mongolian",
    "language_code": "mn",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  {
    "name": "Mongolian (Cyrillic)",
    "language_code": "mn-Cyrl",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Mongolian (Traditional)",
    "language_code": "mn-Mong",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Montenegrin",
    "language_code": "cnr",
    "options": [
      "IBM"
    ]
  },
  {
    "name": "Myanmar (Burmese)",
    "language_code": "my",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Nepali",
    "language_code": "ne",
    "options": [
      "Google",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Norwegian",
    "language_code": "no",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Nyanja (Chichewa)",
    "language_code": "ny",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Odia (Oriya)",
    "language_code": "or",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Pashto",
    "language_code": "ps",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Persian",
    "language_code": "fa",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Polish",
    "language_code": "pl",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Portuguese (Portugal, Brazil)",
    "language_code": "pt",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Portuguese (Portugal)",
    "language_code": "pt-pt",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Punjabi",
    "language_code": "pa",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Queretaru Otomi",
    "language_code": "otq",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Romanian",
    "language_code": "ro",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Russian",
    "language_code": "ru",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Samoan",
    "language_code": "sm",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Scots Gaelic",
    "language_code": "gd",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Serbian",
    "language_code": "sr",
    "options": [
      "Google",
      "Amazon",
      "IBM"
    ]
  },
  {
    "name": "Serbian (Cryllic)",
    "language_code": "sr-Cyrl",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Serbian (Latin)",
    "language_code": "sr-Latn",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Sesotho",
    "language_code": "st",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Shona",
    "language_code": "sn",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Sindhi",
    "language_code": "sd",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Sinhala (Sinhalese)",
    "language_code": "si",
    "options": [
      "Google",
      "Amazon",
      "IBM"
    ]
  },
  {
    "name": "Slovak",
    "language_code": "sk",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Slovenian",
    "language_code": "sl",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Somali",
    "language_code": "so",
    "options": [
      "Google",
      "Amazon"
    ]
  },
  {
    "name": "Spanish",
    "language_code": "es",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Sundanese",
    "language_code": "su",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Swahili",
    "language_code": "sw",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Swedish",
    "language_code": "sv",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Tagalog (Filipino)",
    "language_code": "tl",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ],
    "alternate_code": "fil"
  },
  {
    "name": "Tajik",
    "language_code": "tg",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Tamil",
    "language_code": "ta",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Tatar",
    "language_code": "tt",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Telugu",
    "language_code": "te",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Thai",
    "language_code": "th",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Tibetan",
    "language_code": "bo",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Tigrinya",
    "language_code": "ti",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Turkish",
    "language_code": "tr",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Turkmen",
    "language_code": "tk",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Ukrainian",
    "language_code": "uk",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Urdu",
    "language_code": "ur",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Uyghur",
    "language_code": "ug",
    "options": [
      "Google",
      "Microsoft"
    ]
  },
  {
    "name": "Uzbek",
    "language_code": "uz",
    "options": [
      "Google",
      "Amazon",
      "Microsoft"
    ]
  },
  {
    "name": "Vietnamese",
    "language_code": "vi",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Welsh",
    "language_code": "cy",
    "options": [
      "Google",
      "Amazon",
      "IBM",
      "Microsoft"
    ]
  },
  {
    "name": "Xhosa",
    "language_code": "xh",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Yiddish",
    "language_code": "yi",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Yoruba",
    "language_code": "yo",
    "options": [
      "Google"
    ]
  },
  {
    "name": "Yucatec Maya",
    "language_code": "yua",
    "options": [
      "Microsoft"
    ]
  },
  {
    "name": "Zulu",
    "language_code": "zu",
    "options": [
      "Google"
    ]
  }
]}