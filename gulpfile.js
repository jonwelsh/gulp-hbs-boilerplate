// NOTE: GULP
const { series, parallel, src, dest, watch } = require('gulp');

// NOTE: GENERAL
const header = require('gulp-header'),
	rename = require('gulp-rename'),
	sourcemaps = require('gulp-sourcemaps'),
	del = require('del'),
	newer = require('gulp-newer'),
	lazypipe = require('lazypipe'),
	packageDetails = require('./package.json');

// NOTE: HANDLEBARS
var handlebars = require('gulp-compile-handlebars');

// NOTE: STYLES
const sass = require('gulp-sass'),
	prefix = require('gulp-autoprefixer'),
	purgecss = require('gulp-purgecss'),
	cleanCss = require('gulp-clean-css');

// NOTE: SCRIPTS
const concat = require('gulp-concat'),
	jshint = require('gulp-jshint'),
	stylish = require('jshint-stylish'),
	include = require('gulp-include'),
	uglify = require('gulp-uglify'),
	babel = require('gulp-babel'),
	flatmap = require('gulp-flatmap');

// NOTE: IMAGES
const imagemin = require('gulp-imagemin'),
	webp = require('gulp-webp');

// NOTE: BROWSER SYNC
const browserSync = require('browser-sync').create();

// NOTE: PATHS
const paths = {
	input: 'src/',
	output: 'dist/',
	// HANDLEBARS
	hbs: {
		input: 'src/templates/page/*.{handlebars,hbs}',
		output: 'dist/'
	},
	// STYLES
	styles: {
		input: 'src/assets/scss/**/*.{scss,sass}',
		output: 'dist/assets/css'
	},
	// SCRIPTS
	scripts: {
		input: 'src/assets/js/*.js',
		output: 'dist/assets/js/'
	},
	// IMAGES
	img: {
		input: 'src/assets/img/**/*.{png,jpg,jpeg,gif,svg}',
		output: 'dist/assets/img/'
	},
	// VIDEO
	vid: {
		input: 'src/assets/video/*.mp4',
		output: 'dist/assets/video/'
	},
	// RELOAD
	reload: './dist/'
};

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
		' */\n'
};

let js = lazypipe()
	.pipe(sourcemaps.init)
	.pipe(
		header,
		banner.full,
		{ packageDetails: packageDetails }
	)
	.pipe(include)
	.pipe(babel)
	.pipe(
		dest,
		paths.scripts.output
	)
	.pipe(browserSync.stream)
	.pipe(
		rename,
		{ suffix: '.min' }
	)
	.pipe(babel)
	.pipe(uglify)
	.pipe(
		header,
		banner.min,
		{ packageDetails: packageDetails }
	)
	.pipe(sourcemaps.write.bind(null, './maps'))
	.pipe(
		dest,
		paths.scripts.output
	);

// NOTE: REMOVE EXISTING DIST FOLDER
function clean(done) {
	// clean the build folder
	del.sync([paths.output]);
	return done();
}

// NOTE: COMPILE HBS TO HTML
function hbs() {
	return src(paths.hbs.input)
		.pipe(
			handlebars(
				{},
				{
					ignorePartials: true,
					batch: ['./src/templates/partials/']
				}
			)
		)
		.pipe(rename({ extname: '.html' }))
		.pipe(dest(paths.hbs.output))
		.pipe(browserSync.stream());
}

// NOTE: COMPILE, LINT, CONCAT, REMOVE UNUSED AND MINIFY
function css() {
	return src(paths.styles.input)
		.pipe(sass({ outputStyle: 'expanded', sourceComments: true }))
		.on('error', sass.logError)
		.pipe(
			prefix({
				cascade: true,
				remove: true,
				grid: 'autoplace'
			})
		)
		.pipe(
			purgecss({
				content: ['src/*.html', 'src/**/*.hbs']
			})
		)
		.pipe(header(banner.full, { packageDetails: packageDetails }))
		.pipe(dest(paths.styles.output))
		.pipe(sourcemaps.init())
		.pipe(rename({ suffix: '.min' }))
		.pipe(cleanCss({ level: { 1: { specialComments: 'none' } } }))
		.pipe(header(banner.min, { packageDetails: packageDetails }))
		.pipe(sourcemaps.write('./maps'))
		.pipe(dest(paths.styles.output))
		.pipe(browserSync.stream());
}

// NOTE: COMPILE, CONCAT AND MINIFY
function jsMinify() {
	return src(paths.scripts.input).pipe(
		flatmap(function(stream, file) {
			if (file.isDirectory()) {
				src(file.path + '/*.js')
					.pipe(concat(file.relative + '.js'))
					.pipe(js());

				return stream;
			}

			return stream.pipe(js()).pipe(browserSync.stream());
		})
	);
}

// NOTE: JS ERROR HANDLING
function jsLint() {
	return src(paths.scripts.input)
		.pipe(jshint())
		.pipe(jshint.reporter(stylish));
}

// NOTE: OPTIMISE IMAGE FILES
function img() {
	return src(paths.img.input)
		.pipe(newer(paths.img.output))
		.pipe(
			imagemin([
				imagemin.gifsicle({ interlaced: true }),
				imagemin.jpegtran({ progressive: true }),
				imagemin.optipng({ optimizationLevel: 5 }),
				imagemin.svgo({
					plugins: [{ removeViewBox: true }, { cleanupIDs: false }]
				})
			])
		)
		.pipe(dest(paths.img.output))
		.pipe(newer(paths.img.output))
		.pipe(webp())
		.pipe(dest(paths.img.output));
}

// NOTE: COPY VIDEO FILES
function video() {
	return src(paths.vid.input)
		.pipe(newer(paths.vid.output))
		.pipe(dest(paths.vid.output));
}

// NOTE: INITIATE SERVER
function server(done) {
	browserSync.init({
		server: {
			baseDir: paths.reload
		}
	});
	done();
}

// NOTE: WATCH FOR CHANGES
function changed() {
	return (
		watch(
			['src/assets/scss/'],
			series(css, function cssRelaod(done) {
				browserSync.reload();
				done();
			})
		),
		watch(
			['src/templates/'],
			series(hbs, function hbsRelaod(done) {
				browserSync.reload();
				done();
			})
		),
		watch(
			['src/assets/js/'],
			series(jsMinify, function jsRelaod(done) {
				browserSync.reload();
				done();
			})
		)
	);
}

// COMPILE< WATCH AND RELOAD (gulp watch)
exports.watch = series(
	parallel(hbs),
	parallel(css, series(jsLint)),
	parallel(jsMinify),
	parallel(img, series(video)),
	parallel(server, series(changed))
);

// REMOVE DIST FOLDER (gulp clean)
exports.clean = series(clean);

// COMPILE EVERYTHING NO BROWSER (gulp)
exports.default = series(
	clean,
	parallel(hbs),
	parallel(css, series(jsLint)),
	parallel(jsMinify),
	parallel(img, series(video))
);
