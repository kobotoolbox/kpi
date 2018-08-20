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

# Add .gitignore file
print("Adding .gitignore to {}".format(dest_dir))
with open("{}.gitignore".format(dest_dir), "w") as file:
    file.write("""*.eot
*.svg
*.ttf
*.woff
*.woff2
*.scss
*.css
*.md
*.ijmap
*.otf
codepoints
*.html""".strip())

print("DONE")