# coding: utf-8
import csv
import codecs
from distutils import util
from typing import Dict

from django.contrib import admin
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.db import models, transaction
from django.template.response import TemplateResponse
from django.urls import path


from .transcription import (
    TranscriptionService,
    TranscriptionServiceLanguageM2MInline,
)
from .translation import (
    TranslationService,
    TranslationServiceLanguageM2MInline,
)
from ..forms import ImportForm


class Language(models.Model):

    class Meta:
        verbose_name = 'language'
        ordering = ['-featured', 'name']

    def __str__(self):
        return f'{self.name} ({self.code})'

    # Full name of the language (e.g.: English)
    name = models.CharField(max_length=200)
    # Short language code (e.g.: en)
    code = models.CharField(max_length=10)
    # Short display first when equals `True`
    featured = models.BooleanField(default=False)
    transcription_services = models.ManyToManyField(
        'TranscriptionService',
        through='TranscriptionServiceLanguageM2M',
    )
    translation_services = models.ManyToManyField(
        'TranslationService',
        through='TranslationServiceLanguageM2M',
    )


class LanguageAdmin(admin.ModelAdmin):

    change_list_template = 'admin/languages_change_list.html'
    import_template_name = 'admin/languages_import.html'

    inlines = [
        TranscriptionServiceLanguageM2MInline,
        TranslationServiceLanguageM2MInline,
    ]

    list_display = ['name', 'code', 'featured']
    search_fields = ['name', 'code']

    def get_urls(self):
        urls = super().get_urls()
        language_urls = [
            path(
                'import/',
                self.admin_site.admin_view(self.import_action),
                name='languages_import',
            ),
        ]
        return language_urls + urls

    def import_action(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied

        context = {
            'title': 'Languages import',
            'opts': self.model._meta
        }

        if request.method == 'POST':
            form = ImportForm(request.POST, request.FILES)
            if form.is_valid():
                import_file = request.FILES['import_file']
                context['results'] = self._process_import(import_file)
        else:
            form = ImportForm()

        request.current_app = self.admin_site.name
        context['form'] = form

        return TemplateResponse(
            request, template=self.import_template_name, context=context
        )

    def _process_import(self, uploaded_file: InMemoryUploadedFile) -> Dict:

        results = {
            'created': 0,
            'skipped': 0,
            'translation_services': 0,
            'transcription_services': 0,
        }

        csv_reader = csv.reader(
            codecs.iterdecode(uploaded_file, 'utf-8'),
            delimiter=',',
            quotechar='"',
        )

        # Skip for rows. We expect it to be the column headers.
        headers = next(csv_reader)

        # The first 5 fields should be always the same. All others should be
        # treated as services.
        name, code, featured, region_names, region_codes, *asr_mt_services = headers
        asr_mt_services = [s.lower() for s in asr_mt_services]

        transcription_services = {
            service.code.lower(): service
            for service in TranscriptionService.objects.all()
        }
        translation_services = {
            service.code.lower(): service
            for service in TranslationService.objects.all()
        }

        # Initialize lists and dictionaries for later bulk operations.
        extra_asr_columns = {}
        extra_mt_columns = {}
        new_languages = []
        new_regions = []
        new_transcription_services = []
        new_translation_services = []
        language_transcription_services_through = []
        language_translation_services_through = []

        # Create new services if any and memorize their position in rows to
        # create M2M relationships correctly in bulk operations.
        for service in asr_mt_services:
            service_type, service_code = service.split('_')
            if service_type == 'asr':
                extra_asr_columns[service_code] = (
                    asr_mt_services.index(service) + 5
                )
                if not TranscriptionService.objects.filter(code=service_code).exists():
                    new_transcription_services.append(
                        TranscriptionService(
                            name=service_code.capitalize(), code=service_code
                        )
                    )

            if service_type == 'mt':
                extra_mt_columns[service_code] = (
                    asr_mt_services.index(service) + 5
                )
                if not TranslationService.objects.filter(code=service_code).exists():
                    new_translation_services.append(
                        TranslationService(
                            name=service_code.capitalize(), code=service_code
                        )
                    )

        if new_transcription_services:
            for service in TranscriptionService.objects.bulk_create(
                    new_transcription_services
            ):
                transcription_services[service.code] = service

        if new_translation_services:
            for service in TranslationService.objects.bulk_create(
                new_translation_services
            ):
                translation_services[service.code] = service

        results['translation_services'] = len(new_translation_services)
        results['transcription_services'] = len(new_transcription_services)

        # Iterate on CSV content to import languages and their services
        for row in csv_reader:
            name = row[0].strip()
            code = row[1].strip()
            try:
                featured = util.strtobool(row[2])
            except ValueError:
                featured = False
            region_names = row[3].strip().split(';')
            region_codes = row[4].strip().split(';')

            if not code:
                results['skipped'] += 1
                continue

            # Do not save `Language` objects. Just create them and store them
            # in a memory to save them in bulk operations below.
            new_languages.append(
                Language(name=name, featured=featured, code=code)
            )

            # Do not save `LanguageRegion` objects either. Store them
            # in a memory to save them in bulk operations below.
            if region_names:
                for idx, region_name in enumerate(region_names):
                    if region_name:
                        new_regions.append({
                            'name': region_name,
                            'code': region_codes[idx],
                            'language_code': code,
                        })

            for service, index in extra_asr_columns.items():

                if not row[index]:
                    continue

                # The `asr_*` columns should contain a semi-colon seperated
                # string containing language regions. To help the mapping,
                # the language regions should be in the exact same order as the
                # `region_name` and `region_code` columns. `null` should be used
                # for not supported regions.
                # For example:
                #  region_names | region_codes | asr_service |
                #  -------------|--------------|-------------|
                #  USA;Canada   | en-US;en-CA  | en-US;en-CA |
                #  -------------|--------------|-------------|
                #  France;Canada| fr-FR;fr-CA  | fr-FR;null  |
                #  -------------|--------------|-------------|
                mapping_codes = row[index].split(';')
                for idx, region_code in enumerate(region_codes):
                    # if mapping_codes[idx] == 'null', service
                    # does not provide transcription for this region
                    if mapping_codes[idx] == 'null':
                        continue

                    # We do not have `Language` nor `LanguageRegion` object primary
                    # keys value yet. Let's use their codes (which should be unique)
                    # to map later after bulk insert.
                    language_transcription_services_through.append({
                        'language_code': code,
                        'region_code': region_code,
                        'service_id': transcription_services[service].pk,
                        'mapping_code': mapping_codes[idx],
                    })

            for service, index in extra_mt_columns.items():
                if not row[index]:
                    continue

                # The `mt_*` columns should contain a semi-colon seperated
                # string containing language codes except some exceptions where
                # the region can be used. To help the mapping the language codes
                # (or regions)  should be in the exact same order as the
                # `region_name` and `region_code` columns. `null` should be used
                # for not supported regions.
                # A small difference with `asr_*` columns - which always requires
                # a region - translation services usually only need the language
                # code but sometimes support regions too. In some other rarely
                # cases, it only supports regions.
                # For example:
                #  region_names                  | region_codes | mt_service    |
                #  ------------------------------|--------------|---------------|
                #  USA;Canada                    | en-US;en-CA  | en            |  # only language
                #  ------------------------------|--------------|---------------|
                #  France;Canada                 | fr-FR;fr-CA  | fr;null;fr-CA |  # language and regions
                #  ------------------------------|--------------|---------------|
                #  Serbia Latin, Serbia Cyrillic | sr-RS;sr-CS  |sr-Latn;sr-Cyrl|
                #  ------------------------------|--------------|---------------|
                mapping_codes = row[index].split(';')

                # If there is only one occurrence and it matches language code,
                # it is a trivial case and translation service support the
                # language globally. No regions are needed.
                if (
                    mapping_codes[0] == code
                    and len(mapping_codes) == len(region_codes) + 1
                ):
                    mapping_code = mapping_codes.pop(0)
                    # We do not have `Language` object primary key value yet.
                    # Let's use its codes (which should be unique) to map later
                    # after bulk insert.
                    language_translation_services_through.append({
                        'language_code': code,
                        'region_code': None,
                        'service_id': translation_services[service].pk,
                        'mapping_code': mapping_code,
                    })

                for idx, mapping_code in enumerate(mapping_codes):
                    # if mapping_codes[idx] == 'null', service
                    # does not provide translation for this region
                    if mapping_code == 'null':
                        continue

                    # In case, we did not enter the trivial case, the translation
                    # service may support the language globally but some regions
                    # too (see French in example table above)
                    if mapping_code == code:
                        region_code = None
                    else:
                        region_code = region_codes[idx]

                    # We do not have `Language` nor `LanguageRegion` object primary
                    # keys value yet. Let's use their codes (which should be unique)
                    # to map later after bulk insert.
                    language_translation_services_through.append({
                        'language_code': code,
                        'region_code': region_code,
                        'service_id': translation_services[service].pk,
                        'mapping_code': mapping_codes[idx],
                    })

        with transaction.atomic():
            # Delete all languages first, since we re-import them all.
            Language.objects.all().delete()
            languages = {
                language.code: language
                for language in Language.objects.bulk_create(new_languages)
            }

            new_region_objects = []
            for region in new_regions:
                new_region_objects.append(LanguageRegion(
                    name=region['name'],
                    code=region['code'],
                    language_id=languages[region['language_code']].pk,
                ))

            regions = {
                region.code: region
                for region in LanguageRegion.objects.bulk_create(
                    new_region_objects
                )
            }

            throughs = []
            for through in language_transcription_services_through:
                # Only save mapped code if it differs from language code
                mapping_code = (
                    through['mapping_code']
                    if through['mapping_code']
                    != through['region_code']
                    else None
                )
                throughs.append(Language.transcription_services.through(
                    language_id=languages[through['language_code']].pk,
                    service_id=through['service_id'],
                    region_id=regions[through['region_code']].pk,
                    mapping_code=mapping_code,
                ))
            Language.transcription_services.through.objects.bulk_create(throughs)

            throughs = []
            for through in language_translation_services_through:
                # Only save mapped code if it differs from language code
                if through['region_code']:
                    region_id = regions[through['region_code']].pk
                    mapping_code = (
                        through['mapping_code']
                        if through['mapping_code']
                        != through['region_code']
                        else None
                    )
                else:
                    region_id = None
                    mapping_code = (
                        through['mapping_code']
                        if through['mapping_code']
                        != through['language_code']
                        else None
                    )
                throughs.append(Language.translation_services.through(
                    language_id=languages[through['language_code']].pk,
                    service_id=through['service_id'],
                    region_id=region_id,
                    mapping_code=mapping_code,
                ))
            Language.translation_services.through.objects.bulk_create(throughs)

        results['created'] = len(languages.keys())

        return results


class LanguageRegion(models.Model):

    # Deserialized data to avoid joins on services to get all
    # regions for on language.
    # Notes: Language must be created first in Django Admin before assigning new
    # services
    language = models.ForeignKey(
        Language, related_name='regions', on_delete=models.CASCADE
    )
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)

    class Meta:
        verbose_name = 'region'
        ordering = ['code', 'name']

    def __str__(self):
        return f'{self.code} - {self.language.name} ({self.name})'


class LanguageRegionAdmin(admin.ModelAdmin):

    pass
