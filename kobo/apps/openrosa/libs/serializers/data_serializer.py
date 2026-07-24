from django.utils.translation import gettext as t
from rest_framework import serializers


class SubmissionSerializer(serializers.Serializer):

    class Meta:
        fields = '__all__'

    def to_representation(self, obj):
        if not hasattr(obj, 'xform'):
            return super().to_representation(obj)

        message = self.context.get(
            'confirmation_message', t('Successful submission.')
        )
        return {
            'message': message,
            'formid': obj.xform.id_string,
            'encrypted': obj.xform.encrypted,
            'instanceID': 'uuid:%s' % obj.uuid,
            'submissionDate': obj.date_created.isoformat(),
            'markedAsCompleteDate': obj.date_modified.isoformat()
        }
