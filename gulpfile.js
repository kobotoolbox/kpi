// Currently:
// This gulpfile only focuses on building and running tests of js and react code

var gulp = require("gulp"),
    browserSync = require("browser-sync"),
    browserify = require("browserify"),
    source = require("vinyl-source-stream"),
    clean = require("gulp-clean"),
    mochaPhantomJS = require("gulp-mocha-phantomjs");


gulp.task("browserify", function() {
    "use strict";
    return browserify({
              entries: 'test/index.js',
              extensions: ['.js', '.es6', '.coffee'],
              require: ['jszip'],
              read: false,
            })
            .ignore('jszip')
            .transform("babelify", {
              presets: ['es2015', 'react'],
              extensions: ['.js', '.es6'],
            })
            .transform('coffeeify', {
              extensions: ['.coffee'],
            })
            .bundle()
            .pipe(source('tests-index-compiled.js'))
            .pipe(gulp.dest(__dirname + "/tmp"));
});

gulp.task("clean", function () {
    return gulp.src("tmp/tests-index-compiled.js", {read: false})
            .pipe(clean());
});

gulp.task("test", function () {
    return gulp.src("./test/tests.html").pipe(mochaPhantomJS());
});

gulp.task("browser-sync", function () {
    "use strict";
    browserSync({
        server: {
            //serve tests and the root as base dirs
            baseDir: ["./test/", "./jsapp/"],
            //make tests.html the index file
            index: "tests.html"
        }
    });
});

gulp.task("serve", ["browserify", "browser-sync"], function () {
    "use strict";
    //when tests.js changes, browserify code and execute tests
    gulp.watch(["test/*.js", "test/**/*.js"], ["browserify", "test", "clean"]);
});
