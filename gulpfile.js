
const del = require('del');
const stylish = require('jshint-stylish');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const log = require('fancy-log');
const browserify = require('browserify');
const browserSync = require('browser-sync').create();
const nunjucks = require('nunjucks');
const consolidate = require('consolidate');
const path = require('path');
const through = require('through2')
const jshint = require('gulp-jshint');
const sass = require('gulp-sass');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const minimist = require('minimist');
const tap = require('gulp-tap');
const frontMatter = require('gulp-front-matter');
const markdown = require('gulp-markdown');
const gulpIf = require('gulp-if');
const htmlmin = require('gulp-htmlmin');
const ttf2woff = require('gulp-ttf2woff');
const ttf2woff2 = require('gulp-ttf2woff2');

var gulp = require('gulp-help')(require('gulp'), {
	hideEmpty: true,
	hideDepsMessage: true,
	aliases: ['default'],
	afterPrintCallback: function () {
		console.log('Information about customization is in the README.\n');
	}
});

var config = require('./config.json');
config.debug = !!minimist(process.argv.slice(2)).production === false;
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
			file.contents = Buffer.from(html, 'utf8');
			
			// change extension to the extension of the template file
			// TODO Create an option to also change the extension when the template is generically named (.html.njk)
			var filename = path.basename(file.path, path.extname(file.path)) + path.extname(templatePath);
			file.path = path.join(path.dirname(file.path), filename)
			
			//self.push(file);
			cb(null, file);
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
		log("This is a production run.");
	}

	return gulp.start(
		'build-styles',
		'build-scripts',
		'build-images',
		'build-pages',
		'build-uploads',
		'build-fonts'
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
		log("Don't use 'watch' in production mode. Always do a clean build ahead of deployment.");
	}

	browserSync.init(config.browserSync);

	gulp.watch(config.source.assets + '**/*.scss', ['build-styles']);
	gulp.watch(config.source.assets + '**/*.js', ['build-scripts']);
	gulp.watch(config.source.assets + '**/*.{png,jpg,gif,svg,webp}', ['build-images']);
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
	log("Linting styles is not implemented yet.");
	// TODO Implement lint-styles task
});

gulp.task('lint-templates', function () {
	log('Linting templates is not implemented yet.');
	// TODO Implement lint-styles task
});

// --- Build tasks ---

gulp.task('build-scripts', ['lint-scripts'], function () {
	return gulp.src(config.source.assets + '*.js', {base: config.base.assets, read: false})
		.pipe(tap(function (file) {
			file.contents = browserify(file.path, {debug: config.debug}).bundle();
		}))
		.pipe(buffer())
		.pipe(config.debug ? sourcemaps.init({loadMaps: true}) : through.obj())
		.pipe(config.debug ? through.obj() : uglify()).on('error', log)
		.pipe(config.debug ? sourcemaps.write('./') : through.obj())
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-styles', ['lint-styles'], function () {
	return gulp.src([config.source.assets + '**/*.scss'], {base: config.base.assets})
		.pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
		.pipe(config.debug ? through.obj() : cleanCSS({compatibility: 'ie9', format: 'keep-breaks'}))
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream({match: '**/*.css'}));
});

gulp.task('build-images', function () {
	return gulp.src([config.source.assets + '**/*.{png,jpg,gif,svg,webp}'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-uploads', function () {
	return gulp.src([config.source.uploads + '**/*'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-fonts', function () {
	return gulp.src([config.source.assets + '**/*.{ttf,otf}'], {base: config.base.assets})
		.pipe(ttf2woff({clone: true}))
		.pipe(ttf2woff2({clone: true}))
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
});

gulp.task('build-pages', ['lint-templates'], function () {
	return gulp.src([config.source.content + '**/*'])
		.pipe(frontMatter({property: 'page', remove: true}))
		.pipe(gulpIf(function (file) {
			return file.path.match(/(\.md|\.markdown)$/) !== null;
		}, markdown(config.markdown)))
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
