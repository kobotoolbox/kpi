import glob
import shutil
dest_dir = "./jsapp/fonts/"

print("Copying fonts...")

for file in glob.glob("./node_modules/font-awesome/fonts/*.*"):
    print(file)
    shutil.copy(file, dest_dir)
for file in glob.glob("./node_modules/roboto-fontface/fonts/*.wof*"):
    print(file)
    shutil.copy(file, dest_dir)

print("DONE")