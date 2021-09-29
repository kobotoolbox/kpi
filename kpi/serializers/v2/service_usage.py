from rest_framework import serializers


from kpi.fields import WritableJSONField


class ServiceUsageSerializer(serializers.Serializer):

    payload = WritableJSONField()

# class AttachmentsSerializer(serializers.ModelSerializer):
#     instance = serializers.RelatedField(ReadOnlyKobocatInstance)
#     media_file_size = serializers.IntegerField()
#
#     class Meta:
#         model = ReadOnlyKobocatAttachments
#
#         fields = (
#             'user',
#             'media_file_size',
#         )
#
#
# class SubmissionCounterSerializer(serializers.ModelSerializer):
#
#     user = serializers.RelatedField(KobocatUser)
#     count = serializers.IntegerField()
#
#     class Meta:
#         model = KobocatSubmissionCounter
#         lookup_field = ''
#
#         fields = (
#             'user',
#             'count',
#             'timestamp',
#         )
