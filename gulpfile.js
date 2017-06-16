var gulp = require("gulp");

gulp.task("copy", function () {
    return gulp.src([
          './node_modules/font-awesome/fonts/*',
          './node_modules/roboto-fontface/fonts/*.wof*',
          './jsapp/scss/fonts/k-icons/*',
        ]).pipe(gulp.dest('./jsapp/fonts/'));
});
