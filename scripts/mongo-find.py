import pprint
for mong_sub in settings.MONGO_DB.instances.find():
    pprint.pprint(mong_sub)
