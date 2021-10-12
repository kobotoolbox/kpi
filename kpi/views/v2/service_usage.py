import copy
import json
from datetime import datetime

from django.db.models import Sum
from rest_framework import (
    renderers,
    status,
    viewsets,
)
from rest_framework.response import Response

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatSubmissionCounter,
    KobocatXForm,
    ReadOnlyKobocatAttachments,
    ReadOnlyKobocatInstance
)
from kpi.permissions import IsOwnerOrReadOnly


class ServiceUsageViewSet(viewsets.ViewSet):
    """
    ## Service Usage Tracker
    Tracks the submissions for the current month
    Tracks the current total storage used

    <pre class="prettyprint">
    <b>GET</b> /api/v2/service_usage/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/service_usage/

    ### CURRENT ENDPOINT
    """
    http_method_names = ['get']
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )

    def list(self, request, *args, **kwargs):
        today = datetime.today()
        data = {
            "forms_submissions": [],
            "attachments_usage_details": [],
            "totals": [],
        }
        attachments_queryset = ReadOnlyKobocatAttachments.objects.filter(
            instance__xform__user__username=request.user
        )
        attachments_usage = copy.deepcopy(attachments_queryset)
        attachments_usage = attachments_usage.aggregate(count_sum=Sum('media_file_size'))

        submission_counter_queryset = KobocatSubmissionCounter.objects.filter(
            user__username=request.user,
            timestamp__month=today.month,
            timestamp__year=today.year,
            timestamp__day='01',
        ).aggregate(count_sum=Sum('count'))

        submissions = ReadOnlyKobocatInstance.objects.filter(
            date_created__year=today.year,
            date_created__month=today.month,
            xform__user__username=request.user,
        )
        forms = []
        data.get('totals').append({
            'total_storage_used': attachments_usage.get('count_sum'),
            'monthly_submissions': submission_counter_queryset.get('count_sum')

        })
        for form in submissions:
            id_string = form.xform.id_string
            if id_string not in forms:
                forms.append(id_string)

        for form_id in forms:
            count_per_form = submissions.filter(xform__id_string=form_id).count()
            xform = KobocatXForm.objects.get(id_string=form_id)
            form_title = xform.title
            data.get('forms_submissions').append({
                "form_id": form_id,
                "form_title": form_title,
                "submission_count": count_per_form,
            })

        attachment_form_ids = []

        for attachment in attachments_queryset:
            form_id = attachment.instance.xform.id_string
            if form_id not in attachment_form_ids:
                attachment_form_ids.append(form_id)

        for form_id in attachment_form_ids:
            form = KobocatXForm.objects.get(id_string=form_id)
            title = form.title

            attachments = attachments_queryset.filter(
                instance__xform__id_string=form_id
            ).aggregate(total_storage=Sum('media_file_size'))

            data.get('attachments_usage_details').append({
                'uid': form_id,
                'title': title,
                'storage_used': attachments.get('total_storage')
            })

        json.dumps(data, indent=4)
        return Response(data, status=status.HTTP_200_OK)
