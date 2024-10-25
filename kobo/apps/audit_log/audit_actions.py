from django.db import models


class AuditAction(models.TextChoices):
    CREATE = 'create'
    DELETE = 'delete'
    IN_TRASH = 'in-trash'
    PUT_BACK = 'put-back'
    REMOVE = 'remove'
    UPDATE = 'update'
    AUTH = 'auth'
    DEPLOY = 'deploy'
    ARCHIVE = 'archive'
    UNARCHIVE = 'unarchive'
    REDEPLOY = 'redeploy'
    UPDATE_NAME = 'update-name'
    UPDATE_SETTINGS = 'update-settings'
    