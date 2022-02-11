# coding: utf-8
from django.conf import settings
from rest_framework import serializers

from .asset import AssetSerializer


class DeploymentSerializer(serializers.Serializer):
    backend = serializers.CharField(required=False)
    identifier = serializers.CharField(read_only=True)
    active = serializers.BooleanField(required=False)
    version_id = serializers.CharField(required=False)
    asset = serializers.SerializerMethodField()

    @staticmethod
    def _raise_unless_current_version(asset, validated_data):
        # Stop if the requester attempts to deploy any version of the asset
        # except the current one
        if 'version_id' in validated_data and \
                validated_data['version_id'] != str(asset.version_id):
            raise NotImplementedError(
                'Only the current version_id can be deployed')

    def get_asset(self, obj):
        asset = self.context['asset']
        return AssetSerializer(asset, context=self.context).data

    def create(self, validated_data):
        asset = self.context['asset']
        self._raise_unless_current_version(asset, validated_data)
        # if no backend is provided, use the installation's default backend
        backend_id = validated_data.get('backend',
                                        settings.DEFAULT_DEPLOYMENT_BACKEND)

        # asset.deploy deploys the latest version and updates that versions'
        # 'deployed' boolean value
        asset.deploy(backend=backend_id,
                     active=validated_data.get('active', False))
        return asset.deployment

    def update(self, instance, validated_data):
        """
        If a `version_id` is provided and differs from the current
        deployment's `version_id`, the asset will be redeployed. Otherwise,
        only the `active` field will be updated
        """
        asset = self.context['asset']
        deployment = asset.deployment

        if 'backend' in validated_data and \
                validated_data['backend'] != deployment.backend:
            raise serializers.ValidationError(
                {'backend': 'This field cannot be modified after the initial '
                            'deployment.'})

        if ('version_id' in validated_data and
                validated_data['version_id'] != deployment.version_id):
            # Request specified a `version_id` that differs from the current
            # deployment's; redeploy
            self._raise_unless_current_version(asset, validated_data)
            asset.deploy(
                backend=deployment.backend,
                active=validated_data.get('active', deployment.active)
            )
        elif 'active' in validated_data:
            active = validated_data['active']
            # Set the `active` flag without touching the rest of the deployment
            deployment.set_active(active)
            # If we (re)activate the asset, let's synchronize its media files
            if active:
                asset.async_media_files(force=False)

        return deployment
