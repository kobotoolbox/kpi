from kpi.serializers.v2.deployment import (
    DeploymentSerializer as DeploymentSerializerV2,
)
from .asset import AssetSerializer


class DeploymentSerializer(DeploymentSerializerV2):

    def get_asset(self, obj):
        asset = self.context['asset']
        return AssetSerializer(asset, context=self.context).data
