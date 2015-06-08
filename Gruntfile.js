module.exports = function(grunt) {

  var to5ify = require("babelify");
  var coffeeify = require('coffeeify');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    // 'string-replace': {
    //   // reqjs: {
    //   //   files: {
    //   //       'jsapp/js/libs/xlform.js': [
    //   //         'jsapp/tmp/xlform.js',
    //   //       ]
    //   //   },
    //   //   options: {
    //   //     replacements: [{
    //   //       pattern: /require/g,
    //   //       replacement: '__req__'
    //   //     }]
    //   //   }
    //   // },
    //
    //   // fixreqjs: {
    //   //   files: {
    //   //     'jsapp/compiled/bundle.js': ['jsapp/compiled/bundle.js']
    //   //   },
    //   //   options: {
    //   //     replacements: [{
    //   //       pattern: /__req__/g,
    //   //       replacement: 'require'
    //   //     }]
    //   //   }
    //   // }
    // },
    requirejs: {
      compile_xlform: {
        options: {
          baseUrl: 'jsapp/xlform',
          optimize: 'none',
          stubModules: ['cs'],
          wrap: true,
          exclude: ['coffee-script'],
          name: 'almond',
          include: 'build.js',
          out: 'jsapp/js/libs/xlform.js',
          paths: {
              'almond': 'components/almond/almond',
              'jquery': 'components/jquery/dist/jquery.min',
              'cs' :'components/require-cs/cs',
              // stubbed paths for almond build
              'backbone': 'build_stubs/backbone',
              'underscore': 'build_stubs/underscore',
              'jquery': 'build_stubs/jquery',
              'backbone-validation': 'components/backbone-validation/dist/backbone-validation-amd',
              // 'backbone': 'components/backbone/backbone',
              // 'underscore': 'components/underscore/underscore',
              'coffee-script': 'components/require-cs/coffee-script',
              // project paths
              'xlform': 'src',
          },
        },
      },
    },
    browserify: {
      dist: {
        files: {
          'jsapp/compiled/bundle.js': [
            'jsapp/js/main.es6',
          ],
        },
        options: {
          noParse: [
            'jsapp/js/libs/xlform.js'
          ],
          noparse: [
            'jsapp/js/libs/xlform.js'
          ],
          browserifyOptions: {
              debug: true,
              extensions: ['.es6', '.jsx', '.js', '.coffee'],
              require: [
                // 'jszip',
                // 'xlsx'
              ]
          },
          transform: [
            [ to5ify, { compact: false } ],
            [ coffeeify ]
          ]
        }
      }
    },
    sass: {
      dist: {
        files: {
          'jsapp/compiled/bundle.css': 'jsapp/scss/main.scss'
        }
      }
    },
    uglify: {
      main: {
        files: {
          'jsapp/compiled/bundle.min.js': ['jsapp/compiled/bundle.js']
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
          './jsapp/js/**/*.coffee'
        ]
      },
      css: {
        files: ['jsapp/compiled/bundle.css'],
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
      },
      coffee: {
        files: ['jsapp/xlform/src/*.coffee'],
        tasks: [
          'requirejs:compile_xlform'
        ],
        options: {
          livereload: false
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-browserify');
  // grunt.loadNpmTasks('grunt-string-replace');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('develop', [
    'browserify:dist',
    'sass:dist',
    'watch',
  ]);
  grunt.registerTask('default', ['develop']);

  grunt.registerTask('build', [
    'requirejs:compile_xlform',
    // 'string-replace:reqjs',
    'browserify:dist',
    'sass:dist',
    // 'string-replace:fixreqjs'
  ]);
  grunt.registerTask('buildall', [
    'build',
    'uglify',
  ]);

};
