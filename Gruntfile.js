module.exports = function(grunt) {

  var to5ify = require('babelify');
  var coffeeify = require('coffeeify');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      dev: {
        files: {
          'jsapp/compiled/bundle.js': [
            'jsapp/js/main.es6',
          ],
        },
        options: {
          browserifyOptions: {
              paths: [
                './jsapp/js',
              ],
              debug: true,
              extensions: [
                '.es6',
                '.jsx',
                '.js',
                '.coffee'
              ]
          },
          transform: [
            [ to5ify, { compact: false, presets: ['es2015', 'react'],
              'plugins': ['add-module-exports'] } ],
            [ coffeeify ]
          ]
        }
      }
    },
    clean: {
      js: [
        'jsapp/js/libs/xlform.js',
        'jsapp/js/tmp/',
      ]
    },
    // autoprefixer is required for material-design-icons
    autoprefixer: {
      target: {
        files: {
          'jsapp/compiled/bundle.css': 'jsapp/compiled/bundle.css'
        }
      },
    },
    uglify: {
      main: {
        files: {
          'jsapp/compiled/bundle.min.js': ['jsapp/compiled/bundle.js']
        }
      }
    },
    cssmin: {
      options: {
        shorthandCompacting: false,
        roundingPrecision: -1
      },
      target: {
        files: {
          'jsapp/compiled/bundle.min.css': ['jsapp/compiled/bundle.css']
        }
      }
    },
    copy: {
      fonts: {
        expand: true,
        flatten: true,
        src: [
          './node_modules/font-awesome/fonts/*',
          './node_modules/roboto-fontface/fonts/*.wof*',
          './node_modules/material-design-icons/iconfont/*',
          './jsapp/scss/fonts/k-icons/*',
          ],
        dest: './jsapp/fonts/',
      }
    },
    watch: {
      js: {
        options: {
          livereload: true,
        },
        tasks: ['browserify:dev'],
        // , 'string-replace:fixreqjs'],
        interrupt: true,
        files: [
          './jsapp/js/**/*.es6',
          './jsapp/js/**/*.js',
          './jsapp/js/**/*.jsx',
          './jsapp/js/**/*.coffee',
          './jsapp/xlform/**/*.coffee',
          './jsapp/xlform/**/*.js',
        ]
      },
      css: {
        files: ['jsapp/compiled/bundle.css'],
        options: {
          livereload: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('develop', [
    'browserify:dev',
    'autoprefixer',
    'watch',
  ]);
  grunt.registerTask('js', ['browserify:dev', 'clean']);
  grunt.registerTask('build', [
    'browserify:dev',
    'autoprefixer',
    'clean:js',
  ]);
  grunt.registerTask('buildall', [
    'copy'
  ]);
  grunt.registerTask('default', ['develop']);

};
