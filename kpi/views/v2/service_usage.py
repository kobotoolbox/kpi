import copy
from datetime import datetime

from django.db.models import Sum
from rest_framework import (
    renderers,
    status,
    viewsets,
)
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatSubmissionCounter,
    KobocatXForm,
    ReadOnlyKobocatAttachments,
    ReadOnlyKobocatInstance
)


class ServiceUsageViewSet(viewsets.ViewSet):

    def list(self, request, *args, **kwargs):
        today = datetime.today()
        data = {
            "attachments_usage_details": [],
            "forms_submissions": [],
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
            'media_stored_size': attachments_usage.get('count_sum'),
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

        attachment_submission_ids = []
        submission_form_ids = []

        for attachment in attachments_queryset:
            submission_id = attachment.instance.uuid
            form_id = attachment.instance.xform.id_string
            if submission_id not in attachment_submission_ids:
                attachment_submission_ids.append(submission_id)
            if form_id not in submission_form_ids:
                submission_form_ids.append(form_id)

        forms = KobocatXForm.objects.filter(id_string__in=submission_form_ids)
        for form in forms:
            submission_with_attachments = submissions.filter(uuid__in=attachment_submission_ids, xform=form)
            title = form.title
            xform_id = form.id_string
            data.get('attachments_usage_details').append({
                'form_id': xform_id,
                'form_title': title,
                'submissions_has_attachment': submission_with_attachments.count(),
            })

        return Response(data, status=status.HTTP_200_OK)
