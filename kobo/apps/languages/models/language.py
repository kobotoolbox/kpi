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
            'created_languages': 0,
            'updated_languages': 0,
            'created_transcription_services': 0,
            'created_translation_services': 0,
        }

        csv_reader = csv.reader(
            codecs.iterdecode(uploaded_file, 'utf-8'),
            delimiter=',',
            quotechar='"',
        )

        headers = next(csv_reader)

        name, code, featured, *asr_mt_services = headers
        asr_mt_services = [s.lower() for s in asr_mt_services]

        asr_service_codes = [
            code.lower()
            for code in TranscriptionService.objects.values_list(
                'code', flat=True
            )
        ]
        mt_service_codes = [
            code.lower()
            for code in TranslationService.objects.values_list(
                'code', flat=True
            )
        ]

        extra_asr_columns = {}
        extra_mt_columns = {}

        for service in asr_mt_services:
            service_type, service_name = service.split('_')

            if service_type == 'asr' and service_name in asr_service_codes:
                extra_asr_columns[service_name] = (
                    asr_mt_services.index(service) + 3
                )

            if service_type == 'mt' and service_name in mt_service_codes:
                extra_mt_columns[service_name] = (
                    mt_service_codes.index(service) + 3
                )

        for row in csv_reader:
            name = row[0].strip()
            code = row[1].strip()

            try:
                featured = util.strtobool(row[2])
            except ValueError:
                featured = False

            if not code:
                continue

            language, created = Language.objects.get_or_create(code=code)
            language.name = name
            language.featured = featured

            with transaction.atomic():

                language.save()

                if not created:
                    language.transcription_services.clear()
                    language.translation_services.clear()
                    results['updated_languages'] += 1
                else:
                    results['created_languages'] += 1

                for service, index in extra_asr_columns.items():
                    if not row[index]:
                        continue

                    (
                        transcription_service,
                        created,
                    ) = TranscriptionService.objects.get_or_create(code=service)
                    if created:
                        results['created_transcription_services'] += 1
                    language.transcription_services.add(
                        transcription_service,
                        through_defaults={'code': row[index]},
                    )

                for service, index in extra_mt_columns.items():
                    if not row[index]:
                        continue

                    (
                        translation_service,
                        created,
                    ) = TranslationService.objects.get_or_create(code=service)
                    if created:
                        results['created_translation_services'] += 1
                    language.translation_services.add(
                        translation_service,
                        through_defaults={'code': row[index]},
                    )

        return results
