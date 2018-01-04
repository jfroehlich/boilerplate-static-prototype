
var del = require('del');
var stylish = require('jshint-stylish');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var browserSync = require('browser-sync').create();
var nunjucks = require('nunjucks');
var consolidate = require('consolidate');
var path = require('path');
var through = require('through2')
var fs = require('fs');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var cleanCSS = require('gulp-clean-css');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var tap = require('gulp-tap');
var frontMatter = require('gulp-front-matter');
var markdown = require('gulp-markdown');
var gulpIf = require('gulp-if');
var htmlmin = require('gulp-htmlmin');

var gulp = require('gulp-help')(require('gulp'), {
	hideEmpty: true,
	hideDepsMessage: true,
	aliases: ['default'],
	afterPrintCallback: function () {
		console.log('Information about customization is in the README.\n');
	}
});

var config = require('./config.json');
config.debug = !!gutil.env.production === false;
config.site.url = config.debug ? 'http://localhost:3000' : config.site.url;

function wrapTemplate(options) {
	options.engine = options.engine || 'nunjucks';
	if (options.requires) {
		consolidate.requires[options.engine] = options.requires;
	}

	return through.obj(function (file, enc, cb) {
		var template = typeof options.template === 'function' ? options.template(file) : options.template;
		var data = typeof options.data === 'function' ? options.data(file) : options.data;
		var templatePath =  path.join(__dirname, options.templateRoot, template);
		var self = this;

		data.content = file.contents.toString();
		consolidate[options.engine](templatePath, data).then(function (html) {
			file.contents = new Buffer(html, 'utf8');
			self.push(file);
			cb();
		}).catch(function (err) {
			throw err;
		});
	});
}

// --- Management methods ---

gulp.task('default', false, ['help']);

/**
 * Runs all the linting tasks.
 */
gulp.task('lint', 'Runs all linting tasks.', function () {
	return gulp.start(
		'lint-styles',
		'lint-scripts',
		'lint-templates'
	);
});

/**
 * Runs a full build of the project.
 *
 * Cleans the destination folder before building the project. Linting is done
 * by each build task individually.
 *
 * If you want a production run do use this:
 * 		gulp build --type=production
 */
gulp.task('build', "Runs a full build of the project.", ['clean'], function () {
	if (config.debug === false) {
		gutil.log("This is a production run.");
	}

	return gulp.start(
		'build-styles',
		'build-scripts',
		'build-images',
		'build-fonts',
		'build-pages',
		'build-uploads'
	);
}, {
	options: {
		'production': "Does a production build with compressed output."
	}
});

/**
 * Removes everything in the target folder.
 */
gulp.task('clean', "Removes everything in the target path.", function () {
	return del([config.target + '**/*']);
});

gulp.task('watch', "Runs a full build and keeps watching the target path.", ['build'], function() {
	if (config.debug === false) {
		gutil.log("Don't use 'watch' in production mode. Always do a clean build ahead of deployment.");
	}

	browserSync.init(config.browserSync);

	gulp.watch(config.source.assets + '**/*.scss', ['build-styles']);
	gulp.watch(config.source.assets + '**/*.js', ['build-scripts']);
	gulp.watch(config.source.assets + '**/*.{png,jpg,gif,svg}', ['build-images']);
	gulp.watch(config.source.assets + '**/*.{ttf,otf,eot,woff,woff2}', ['build-fonts']);
	gulp.watch(config.source.uploads + '**/*', ['build-uploads']);
	gulp.watch(config.source.content + '**/*', ['build-pages']);
	gulp.watch(config.source.templates + '**/*', ['build-pages']);
});

// --- Linting tasks ---

gulp.task('lint-scripts', function () {
	return gulp.src([config.source.assets + '**/*.js', '!' + config.source.vendor + '**/*.js'])
		.pipe(jshint('.jshintrc'))
		.pipe(jshint.reporter(stylish));
});

gulp.task('lint-styles', function () {
	gutil.log("Linting styles is not implemented yet.");
	// TODO Implement lint-styles task
});

gulp.task('lint-templates', function () {
	gutil.log('Linting templates is not implemented yet.');
	// TODO Implement lint-styles task
});

// --- Build tasks ---

gulp.task('build-scripts', ['lint-scripts'], function () {
	return gulp.src(config.source.assets + '*.js', {base: config.base.assets, read: false})
		.pipe(tap(function (file) {
			file.contents = browserify(file.path, {debug: config.debug}).bundle();
		}))
		.pipe(buffer())
		.pipe(config.debug ? sourcemaps.init({loadMaps: true}) : gutil.noop())
		.pipe(config.debug ? gutil.noop() : uglify()).on('error', gutil.log)
		.pipe(config.debug ? sourcemaps.write('./') : gutil.noop())
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-styles', ['lint-styles'], function () {
	return gulp.src([config.source.assets + '**/*.scss'], {base: config.base.assets})
		.pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
		.pipe(config.debug ? gutil.noop() : cleanCSS({compatibility: 'ie9', format: 'keep-breaks'}))
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream({match: '**/*.css'}));
});

gulp.task('build-images', function () {
	return gulp.src([config.source.assets + '**/*.{png,jpg,gif,svg}'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-uploads', function () {
	return gulp.src([config.source.uploads + '**/*'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-fonts', function () {
	return gulp.src([config.source.assets + '**/*.{ttf,otf,eot,woff,woff2}'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-pages', ['lint-templates'], function () {
	return gulp.src([config.source.content + '**/*'])
		.pipe(frontMatter({property: 'page', remove: true}))
		.pipe(gulpIf(function (file) {
			return file.path.match(/(\.md|\.markdown)$/) !== null;
		}, markdown()))
		.pipe(gulpIf(function (file) {
			return !file.isDirectory() && !!file.page.layout;
		}, wrapTemplate({
			template: function (file) {return file.page.layout;},
			data: function (file) {return {page: file.page, site: config.site}},
			engine: 'nunjucks',
			templateRoot: config.source.templates,
			requires: nunjucks.configure(path.join(__dirname, config.source.templates), {
				autoescape: true,
				throwOnUndefined: false,
				trimBlocks: false,
				trimBlocks: false,
				noCache: true
			})
		})))
		.pipe(gulpIf(function (file) {
			return file.path.match(/(\.html)$/) !== null && !config.debug;
		}, htmlmin({
			collapseWhitespace: true,
			preserveLineBreaks: false,
			keepClosingSlash: true,
			removeComments: true,
			removeAttributeQuotes: false
		})))
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});
