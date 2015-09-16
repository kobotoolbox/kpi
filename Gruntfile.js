module.exports = function(grunt) {

  var to5ify = require("babelify");
  var coffeeify = require('coffeeify');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    'string-replace': {
      reqjs: {
        files: {
            'jsapp/js/libs/xlform.js': [
              'jsapp/js/tmp/xlform.js',
            ]
        },
        options: {
          replacements: [{
            pattern: /require/g,
            replacement: '__req__'
          }]
        }
      },
      fixreqjs: {
        files: {
          'jsapp/compiled/bundle.js': ['jsapp/compiled/bundle.js']
        },
        options: {
          replacements: [{
            pattern: /__req__/g,
            replacement: 'require'
          }]
        }
      }
    },
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
          out: 'jsapp/js/tmp/xlform.js',
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
      dev: {
        files: {
          'jsapp/compiled/bundle.js': [
            'jsapp/js/main.es6',
          ],
        },
        options: {
          browserifyOptions: {
              noParse: [
                'jsapp/js/libs/xlform.js'
              ],
              debug: true,
              extensions: ['.es6', '.jsx', '.js', '.coffee'],
              // require: [
              //   'jszip',
              //   'xlsx'
              // ]
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
          './jsapp/xlform/components/fontawesome/fonts/fontawesome-webfont.*',
          './node_modules/open-sans-fontface/fonts/Regular/*',
          './node_modules/open-sans-fontface/fonts/Italic/*',
          './node_modules/open-sans-fontface/fonts/SemiboldItalic/*',
          './node_modules/open-sans-fontface/fonts/Semibold/*',
          './node_modules/material-design-icons/iconfont/Material*',
          ],
        dest: './jsapp/fonts/',
      }
    },
    watch: {
      js: {
        options: {
          livereload: true,
        },
        tasks: ['browserify', 'string-replace:fixreqjs'],
        interrupt: true,
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
        tasks: ['sass','autoprefixer'],
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
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-string-replace');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('develop', [
    'browserify:dev',
    'sass:dist',
    'autoprefixer',
    'watch',
  ]);
  grunt.registerTask('js', ['browserify:dev']);
  grunt.registerTask('default', ['develop']);

  grunt.registerTask('build', [
    'requirejs:compile_xlform',
    'string-replace:reqjs',
    'browserify:dev',
    'sass:dist',
    'autoprefixer',
    'string-replace:fixreqjs'
  ]);
  grunt.registerTask('buildall', [
    'build',
    'copy',
    'uglify',
    'cssmin',
  ]);

};
