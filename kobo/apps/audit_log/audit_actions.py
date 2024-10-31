from django.db import models


class AuditAction(models.TextChoices):
    ARCHIVE = 'archive'
    AUTH = 'auth'
    CREATE = 'create'
    DELETE = 'delete'
    DEPLOY = 'deploy'
    DISABLE_SHARING = 'disable-sharing'
    ENABLE_SHARING = 'enable-sharing'
    IN_TRASH = 'in-trash'
    MODIFY_SHARING = 'modify_sharing'
    PUT_BACK = 'put-back'
    REDEPLOY = 'redeploy'
    REMOVE = 'remove'
    UNARCHIVE = 'unarchive'
    UPDATE = 'update'
    UPDATE_CONTENT = 'update-content'
    UPDATE_NAME = 'update-name'
    UPDATE_SETTINGS = 'update-settings'
    UPDATE_QA = 'update-qa'
