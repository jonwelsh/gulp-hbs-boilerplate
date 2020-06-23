// NOTE: GULP
const { series, parallel, src, dest, watch } = require('gulp')

// NOTE: GENERAL
const header = require('gulp-header')
const rename = require('gulp-rename')
const sourcemaps = require('gulp-sourcemaps')
const del = require('del')
const newer = require('gulp-newer')
const packageDetails = require('./package.json')

// NOTE: HANDLEBARS
var handlebars = require('gulp-compile-handlebars')

// NOTE: STYLES
const sass = require('gulp-sass')
const prefix = require('gulp-autoprefixer')
const purgecss = require('gulp-purgecss')
const cleanCss = require('gulp-clean-css')

// NOTE: SCRIPTS
const jshint = require('gulp-jshint')
const stylish = require('jshint-stylish')
const include = require('gulp-include')
const terser = require('gulp-terser')
const babel = require('gulp-babel')

// NOTE: ERROR HANDLING
const plumber = require('gulp-plumber')
const notify = require('gulp-notify')

// NOTE: IMAGES
const imagemin = require('gulp-imagemin')
const webp = require('gulp-webp')

// NOTE: BROWSER SYNC
const browserSync = require('browser-sync').create()

// NOTE: PATHS
const paths = {
  input: 'src/',
  output: 'build/',
  // HANDLEBARS
  hbs: {
    input: 'src/templates/page/*.{handlebars,hbs}',
    output: 'build/',
  },
  // STYLES
  styles: {
    input: 'src/assets/scss/**/*.{scss,sass}',
    output: 'build/assets/css',
  },
  // SCRIPTS
  scripts: {
    input: 'src/assets/js/*.js',
    output: 'build/assets/js/',
  },
  // IMAGES
  img: {
    input: 'src/assets/img/**/*.{png,jpg,jpeg,gif,svg}',
    output: 'build/assets/img/',
  },
  // VIDEO
  vid: {
    input: 'src/assets/video/*.mp4',
    output: 'build/assets/video/',
  },
  // RELOAD
  reload: './build/',
}

// NOTE: FILE HEADERS
const banner = {
  full:
    '/*!\n' +
    ' * <%= packageDetails.name %> \n' +
    ' * <%= packageDetails.description %> \n' +
    ' * <%= packageDetails.author %> \n' +
    ' * <%= packageDetails.repository.url %> \n' +
    ' */\n\n',
  min:
    '/*!' +
    ' * <%= packageDetails.name %>' +
    ' | <%= packageDetails.author %>' +
    ' | <%= packageDetails.repository.url %>' +
    ' */\n',
}

// NOTE: REMOVE EXISTING BUILD FOLDER
function clean(done) {
  // clean the build folder
  del.sync([paths.output])
  return done()
}

// NOTE: COMPILE HBS TO HTML
function hbs() {
  return src(paths.hbs.input)
    .pipe(
      handlebars(
        {},
        {
          ignorePartials: true,
          batch: ['./src/templates/partials/'],
        }
      )
    )
    .pipe(rename({ extname: '.html' }))
    .pipe(dest(paths.hbs.output))
    .pipe(browserSync.stream())
}

// NOTE: COMPILE, LINT, CONCAT, REMOVE UNUSED AND MINIFY
function css() {
  return src(paths.styles.input)
    .pipe(
      plumber({
        errorHandler: function (err) {
          notify.onError({
            title: 'SCSS Error!',
            subtitle: 'See the terminal for more information.',
            message: '<%= error.message %>',
            wait: false,
            templateOptions: {
              date: new Date().toDateString(),
            },
          })(err)
        },
      })
    )
    .pipe(sass({ outputStyle: 'expanded', sourceComments: true }))
    .on('error', sass.logError)
    .pipe(
      prefix({
        cascade: true,
        remove: true,
        grid: 'autoplace',
      })
    )
    .pipe(
      purgecss({
        content: ['src/*.html', 'src/**/*.hbs'],
      })
    )
    .pipe(header(banner.full, { packageDetails: packageDetails }))
    .pipe(dest(paths.styles.output))
    .pipe(sourcemaps.init())
    .pipe(rename({ suffix: '.min' }))
    .pipe(cleanCss({ level: { 1: { specialComments: 'none' } } }))
    .pipe(
      notify({
        title: 'Stylesheet updated successfully',
        message: '<%= file.relative %>',
      })
    )
    .pipe(header(banner.min, { packageDetails: packageDetails }))
    .pipe(sourcemaps.write('./maps'))
    .pipe(dest(paths.styles.output))
    .pipe(browserSync.stream())
}

function js() {
  return src(paths.scripts.input)
    .pipe(
      plumber({
        errorHandler: function (err) {
          notify.onError({
            title: 'JavaScript Error!',
            subtitle: 'See the terminal for more information.',
            message: '<%= error.message %>',
            onLast: true,
            wait: false,
            templateOptions: {
              date: new Date().toDateString(),
            },
          })(err)
        },
      })
    )
    .pipe(header(banner.full, { packageDetails: packageDetails }))
    .pipe(sourcemaps.init())
    .pipe(include())
    .pipe(babel())
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(dest(paths.scripts.output))
    .pipe(rename({ suffix: '.min' }))
    .pipe(terser())
    .pipe(header(banner.min, { packageDetails: packageDetails }))
    .pipe(
      notify({
        title: 'JS updated successfully',
        message: '<%= file.relative %>',
      })
    )
    .pipe(sourcemaps.write('./maps'))
    .pipe(dest(paths.scripts.output))
    .pipe(browserSync.stream())
}

// NOTE: OPTIMISE IMAGE FILES
function img() {
  return src(paths.img.input)
    .pipe(newer(paths.img.output))
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.mozjpeg({ progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo({
          plugins: [{ removeViewBox: true }, { cleanupIDs: false }],
        }),
      ])
    )
    .pipe(dest(paths.img.output))
    .pipe(newer(paths.img.output))
    .pipe(webp())
    .pipe(dest(paths.img.output))
}

// NOTE: COPY VIDEO FILES
function video() {
  return src(paths.vid.input).pipe(newer(paths.vid.output)).pipe(dest(paths.vid.output))
}

// NOTE: INITIATE SERVER
function server(done) {
  browserSync.init({
    server: {
      baseDir: paths.reload,
    },
  })
  done()
}

// NOTE: WATCH FOR CHANGES
function changed() {
  return (
    watch(
      ['src/assets/scss/'],
      series(css, function cssRelaod(done) {
        browserSync.reload()
        done()
      })
    ),
    watch(
      ['src/templates/'],
      series(hbs, function hbsRelaod(done) {
        browserSync.reload()
        done()
      })
    ),
    watch(
      ['src/assets/js/'],
      series(js, function jsRelaod(done) {
        browserSync.reload()
        done()
      })
    )
  )
}

// REMOVE DIST FOLDER (gulp clean)
exports.clean = series(clean)

// MEDIA TO BE MINIFIED
exports.media = series(img, video)

// COMPILE, WATCH AND RELOAD (gulp watch)
exports.watch = parallel(series(hbs, css, js), series(img, video), series(server, changed))

// CLEAN OLD AND COMPILE EVERYTHING NO BROWSER (gulp)
exports.default = series(clean, parallel(hbs), parallel(css), parallel(js), parallel(img, series(video)))
