# coding: utf-8
import csv
import io
import codecs
from distutils import util
from typing import Dict

from django.contrib import admin
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.db import models, transaction
from django.template.response import TemplateResponse
from django.urls import path, include


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
        TranslationServiceLanguageM2MInline,
        TranscriptionServiceLanguageM2MInline,
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
            'title': 'Import',
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

        headers = next(csv_reader)

        name, code, featured, *asr_mt_services = headers
        asr_mt_services = [s.lower() for s in asr_mt_services]

        transcription_services = {
            service.code.lower(): service
            for service in TranscriptionService.objects.all()
        }
        translation_services = {
            service.code.lower(): service
            for service in TranslationService.objects.all()
        }

        extra_asr_columns = {}
        extra_mt_columns = {}
        new_languages = []
        new_transcription_services = []
        new_translation_services = []
        language_transcription_services_through = []
        language_translation_services_through = []

        for service in asr_mt_services:
            service_type, service_code = service.split('_')
            if service_type == 'asr':
                extra_asr_columns[service_code] = (
                    asr_mt_services.index(service) + 3
                )
                if not TranscriptionService.objects.filter(code=service_code).exists():
                    new_transcription_services.append(
                        TranscriptionService(
                            name=service_code.capitalize(), code=service_code
                        )
                    )

            if service_type == 'mt':
                extra_mt_columns[service_code] = (
                    asr_mt_services.index(service) + 3
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

        print("new_translation_services", new_translation_services, flush=True)
        print("new_transcription_services", new_transcription_services, flush=True)
        print("translation_services", translation_services, flush=True)
        print("transcription_services", transcription_services, flush=True)

        for row in csv_reader:
            name = row[0].strip()
            code = row[1].strip()

            try:
                featured = util.strtobool(row[2])
            except ValueError:
                featured = False

            if not code:
                results['skipped'] += 1
                continue

            new_languages.append(
                Language(name=name, featured=featured, code=code)
            )

            for service, index in extra_asr_columns.items():

                if not row[index]:
                    continue

                language_transcription_services_through.append({
                    'language_code': code,
                    'service_id': transcription_services[service].pk,
                    'mapped_language_code': row[index],
                })

            for service, index in extra_mt_columns.items():
                if not row[index]:
                    continue

                language_translation_services_through.append({
                    'language_code': code,
                    'service_id': translation_services[service].pk,
                    'mapped_language_code': row[index],
                })

        with transaction.atomic():
            Language.objects.all().delete()
            languages = {
                language.code: language
                for language in Language.objects.bulk_create(new_languages)
            }

            throughs = []
            for through in language_transcription_services_through:
                mapped_code = (
                    through['mapped_language_code']
                    if through['mapped_language_code']
                    != through['language_code']
                    else None
                )
                throughs.append(Language.transcription_services.through(
                    language_id=languages[through['language_code']].pk,
                    service_id=through['service_id'],
                    code=mapped_code,
                ))
            Language.transcription_services.through.objects.bulk_create(throughs)

            throughs = []
            for through in language_translation_services_through:
                mapped_code = (
                    through['mapped_language_code']
                    if through['mapped_language_code']
                    != through['language_code']
                    else None
                )
                throughs.append(Language.translation_services.through(
                    language_id=languages[through['language_code']].pk,
                    service_id=through['service_id'],
                    code=mapped_code,
                ))
            Language.translation_services.through.objects.bulk_create(throughs)

        results['created'] = len(languages.keys())

        return results
