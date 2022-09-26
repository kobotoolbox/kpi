from dateutil.relativedelta import relativedelta
from django.utils import timezone
from rest_framework import serializers


class AssetCountsSerializer(serializers.Serializer):
    daily_submission_counts = serializers.SerializerMethodField()
    total_submission_count = serializers.SerializerMethodField()

    class Meta:
        fields = ('daily_submission_counts', 'total_submission_count')

    def get_daily_submission_counts(self, asset):
        today = timezone.now().date()
        if 'days' in self.context:
            start_date = today - relativedelta(days=int(self.context['days']))
        else:
            start_date = today - relativedelta(days=31)
        daily_counts = asset.deployment.get_daily_counts(timeframe=(start_date, today))
        return daily_counts

    def get_total_submission_count(self, asset):
        return asset.deployment.submission_count
