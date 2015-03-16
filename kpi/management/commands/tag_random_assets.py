from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.conf import settings
from django.forms.models import model_to_dict
import dateutil.parser
from kpi.models import Collection
from kpi.models import SurveyAsset
import random

# random words
TAGS = ' '.join(['dissentingly apertural antihygienic fascicular tomahawk aketon',
                'cowbane nicety immaterialised supertonic uncascaded milfoil',
                'terroristic elgar pyrocatechol folkestone astigmatometry encephalographic',
                'grasslike crystallite nonarmigerous absinthe bisection focussed sunnyvale',
                'aeolus jersey interchoking achronychous judaizer thiasus fustigated cassoon',
                'mutazilite pediococcus desulphurise sundays nonprojective ingestion patientness']).split(' ')


def rand_tag():
    return random.choice(TAGS)

class Command(BaseCommand):
    def handle(self, *args, **options):
        for collection in Collection.objects.all():
            if random.randint(0, 3) == 0:
                tag = rand_tag()
                print  'adding tag to collection: '+tag
                collection.tags.add(tag)
        for sa in SurveyAsset.objects.all():
            if random.randint(0, 3) == 0:
                tag = rand_tag()
                print  'adding tag to survey_asset: '+tag
                sa.tags.add(tag)
