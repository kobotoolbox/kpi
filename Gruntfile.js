module.exports = function(grunt) {

  var to5ify = require("babelify");
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      dist: {
        files: {
          'jsapp/dist/bundle.js': [
            'jsapp/js/main.es6',
          ],
        },
        options: {
          browserifyOptions: {
              debug: true,
              extensions: ['.es6', '.jsx', '.js']
          },
          transform: [
            [ to5ify ]
          ]
        }
      }
    },
    sass: {
      dist: {
        files: {
          'jsapp/css/bundle.css': 'jsapp/scss/main.scss'
        }
      }
    },
    watch: {
      js: {
        options: {
          livereload: true
        },
        tasks: ['browserify'],
        files: [
          './jsapp/js/**/*.es6',
          './jsapp/js/**/*.js',
          './jsapp/js/**/*.jsx',
        ]
      },
      css: {
        files: ['jsapp/css/bundle.css'],
        options: {
          livereload: true
        }
      },
      sass: {
        tasks: ['sass'],
        files: ['jsapp/scss/**/*.scss'],
        options: {
          livereload: false
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.registerTask('develop', [
    'browserify:dist',
    'sass:dist',
    'watch',
  ]);
  grunt.registerTask('default', ['develop']);

};
