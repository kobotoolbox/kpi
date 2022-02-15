import datetime
import io
import re
import requests

from django.http import QueryDict
from django.shortcuts import Http404
from django.urls import reverse
from django.utils.translation import gettext as t
from google.cloud import speech_v1
from google.cloud import storage
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.permissions import SubmissionPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AutomatedTranscription(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    viewsets.ViewSet
):
    permission_classes = (SubmissionPermission,)

    def list(self, request, *args, **kwargs):
        # create new automated translation
        # Parameters:
        # - Source Language
        # - Audio/video to transcribe
        # - Engine

        # Should this an endpoint nested in the data endpoint like attachments? --- Probably yes

        # Things I need:
        # Static lists PR merged
        # The attachment endpoint at a point where I can start adding formats to it
        # The storage models

        # Get the attachment endpoint for the audio file
        submission_id = kwargs['parent_lookup_data']
        filters = request.query_params.dict()
        audio_path = filters['xpath']

        attachment_request_params = {
            'parent_lookup_asset': self.asset.uid,
            'parent_lookup_data': submission_id,
        }

        attachment_path = reverse(
            'api_v2:attachment-list',
            kwargs=attachment_request_params
        )

        engine = filters['engine']
        if engine == 'Google':
            try:
                source_language = filters['source']
            except KeyError:
                raise serializers.ValidationError({
                    'detail': t(
                        'missing a query parameter. source, target, and xpath are required'
                    )
                }, 'xpath_missing')

            attachment_queries = QueryDict('', mutable=True)
            attachment_queries.update(
                {
                    'xpath': audio_path,
                    'format': 'flac',
                }
            )

            attachment_url = 'http://kf.kobo.local{baseurl}?{queries}'.format(
                baseurl=attachment_path,
                queries=attachment_queries.urlencode()
            )

            attachment_response = requests.get(
                attachment_url,
                headers={'Authorization': f'Token {request.user.auth_token}'}
            )

            # Todo: Create a check for the engine and the languages here
            content_disposition = attachment_response.headers['Content-Disposition']
            filename = re.findall("filename=(.+)", content_disposition)[0]

            # Store the file in google storage
            destination_path = f"{self.request.user}/{filename}"
            storage_client = storage.Client()
            bucket_name = 'kobo-transcription-test'
            bucket = storage_client.bucket(bucket_name=bucket_name)
            destination = bucket.blob(destination_path)
            destination.upload_from_file(io.BytesIO(attachment_response.content))

            # Transcribe the file
            speech_client = speech_v1.SpeechClient()
            audio = speech_v1.RecognitionAudio(uri=f'gs://{bucket_name}/{destination_path}')
            config = speech_v1.RecognitionConfig(
                encoding=speech_v1.RecognitionConfig.AudioEncoding.FLAC,
                language_code=source_language,
                audio_channel_count=2,
                enable_automatic_punctuation=True,
            )
            speech_results = speech_client.long_running_recognize(
                config=config,
                audio=audio,
            )
            results = speech_results.result()
            print(results, flush=True)

            transcript = []

            for result in results.results:
                alternatives = result.alternatives
                transcript.append(alternatives[0].transcript)

            return Response(transcript)
