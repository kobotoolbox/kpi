# coding: utf-8
import sys

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.http import urlencode

from kobo.apps.openrosa.apps.viewer.models.parsed_instance import xform_instances
from kobo.apps.openrosa.apps.logger.models.instance import Instance


class Command(BaseCommand):

    help = 'Rewrite attachments urls to point to new protected endpoint'
    BATCH_SIZE = 1000

    def handle(self, *args, **kwargs):

        self.__cached_instances = {}
        self.__last_id = None

        cursor = self.__get_data()
        instances_count = cursor.count()
        done = 0
        stop = False
        while stop is not True:
            batch_count = cursor.count(True)
            if batch_count > 0:
                for instance in cursor:
                    for attachment in instance.get("_attachments"):
                        try:
                            # Attachments in old instances were saved as strings
                            # which were their `download_url`
                            # Replace them with the new `dict` format
                            if type(attachment) != dict:
                                filename = attachment
                                xform_id, id, mimetype = self.__get_relationship(
                                    instance.get("_id"), filename)
                                attachment = {
                                    "mimetype": mimetype,
                                    "download_url": self.__secure_url(filename),
                                    "filename": filename,
                                    "instance": instance.get("_id"),
                                    "id": id,
                                    "xform": xform_id
                                }
                            else:
                                filename = attachment.get("filename")
                                attachment["download_url"] = self.__secure_url(
                                    filename)

                            for suffix in settings.THUMB_CONF.keys():
                                attachment["download_{}_url".format(suffix)] = \
                                    self.__secure_url(filename, suffix)

                        except Exception as e:
                            self.stderr.write("ERROR - {}".format(str(e)))
                            self.stderr.write(instance)

                    done += 1
                    self.__last_id = instance.get("_id")
                    xform_instances.save(instance)
                    progress = "\r(%s/%s records) - %.2f %% done..." % (
                        done, instances_count,
                        (float(done) / float(instances_count)) * 100
                    )
                    sys.stdout.write(progress)
                    sys.stdout.flush()

                cursor = self.__get_data()
            else:
                stop = True

        sys.stdout.write("\nUpdated %s records\n" % instances_count)

    def __get_data(self):
        query = {"$and": [
            {"_attachments": {"$ne": ""}},
            {"_attachments": {"$ne": []}},
            {"$or": [
                {"_attachments.download_url": {"$regex": ".*media_file=media_file.*"}},
                {"_attachments.download_small_url": {"$exists": False}}
            ]}
        ]}

        if self.__last_id is not None:
            query.update({
                "_id": {"$gt": self.__last_id}
            })

        return xform_instances.find(query).limit(self.BATCH_SIZE)

    @staticmethod
    def __secure_url(filename, suffix="original"):
        """
        Returns image URL through kobocat redirector.
        :param filename: str. relative path to filename
        :param suffix: str. original|large|medium|small
        :return: str
        """
        return "{kobocat_url}{media_url}{suffix}?{media_file}".format(
            kobocat_url=settings.KOBOCAT_URL,
            media_url=settings.MEDIA_URL,
            suffix=suffix,
            media_file=urlencode({"media_file": filename})
        )

    def __get_relationship(self, instance_id, filename):
        """
        Retrieves XForm, Attachment Id & mimetype of filename

        This method can be hard on RAM.

        Maybe needs some garbage collecting logic
        :param instance_id: int
        :param filename: str
        :return: tuple
        """

        if instance_id not in self.__cached_instances:
            instance = Instance.objects.get(id=instance_id)
            self.__cached_instances[instance_id] = {
                "xform_id": instance.xform.id,
                "attachments": [{
                    "mimetype": attachment.mimetype,
                    "filename": attachment.media_file,
                    "id": attachment.id
                } for attachment in instance.attachments.all()]
            }

        for attachment in self.__cached_instances[instance_id].get("attachments"):
            if filename == attachment.get("filename"):
                return (self.__cached_instances[instance_id].get("xform_id"),
                        attachment.get("id"),
                        attachment.get("mimetype"))

        return None, None, None
