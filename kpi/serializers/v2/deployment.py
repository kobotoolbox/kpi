from django.conf import settings
from pyxform.errors import PyXFormError
from pyxform.validators.enketo_validate import EnketoValidateError
from pyxform.validators.odk_validate import ODKValidateError
from rest_framework import serializers
from xlsxwriter.exceptions import DuplicateWorksheetName

from .asset import AssetSerializer


class DeploymentSerializer(serializers.Serializer):
    backend = serializers.CharField(required=False)
    active = serializers.BooleanField(required=False)
    version_id = serializers.CharField(required=False)
    asset = serializers.SerializerMethodField()

    @staticmethod
    def _raise_unless_current_version(asset, validated_data):
        # Stop if the requester attempts to deploy any version of the asset
        # except the current one
        if 'version_id' in validated_data and validated_data[
            'version_id'
        ] != str(asset.version_id):
            raise NotImplementedError(
                'Only the current version_id can be deployed')

    def get_asset(self, obj):
        asset = self.context['asset']
        return AssetSerializer(asset, context=self.context).data

    def create(self, validated_data):
        asset = self.context['asset']
        self._raise_unless_current_version(asset, validated_data)
        # if no backend is provided, use the installation's default backend
        backend_id = validated_data.get('backend', settings.DEFAULT_DEPLOYMENT_BACKEND)

        # `asset.deploy()` deploys the latest version and updates that versions'
        # 'deployed' boolean value
        try:
            asset.deploy(backend=backend_id, active=validated_data.get('active', False))
        except (
            DuplicateWorksheetName,
            EnketoValidateError,
            PyXFormError,
            ODKValidateError,
        ) as e:
            raise serializers.ValidationError({'error': str(e)})
        return asset.deployment

    def update(self, instance, validated_data):
        """
        Redeploy unconditionally. If people want to deploy again the same
        version that's already deployed, let them. They may have a good reason
        for doing so, e.g. updating form media files.
        """
        asset = self.context['asset']
        deployment = asset.deployment

        if (
            validated_data.pop('backend', deployment.backend)
            != deployment.backend
        ):
            raise serializers.ValidationError(
                {
                    'backend': (
                        'This field cannot be modified after the initial '
                        'deployment.'
                    )
                }
            )

        if validated_data.keys() == set(('active',)):
            # This request is only changing the active (aka archived) state,
            # not actually doing a deployment
            deployment.set_active(validated_data['active'])
            return deployment

        self._raise_unless_current_version(asset, validated_data)
        asset.deploy(
            backend=deployment.backend,
            active=validated_data.get('active', deployment.active),
        )

        return deployment
