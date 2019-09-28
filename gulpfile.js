/* eslint-env node,es6 */

const path = require('path');
const fs = require('fs');
const del = require('del');
const buffer = require('vinyl-buffer');
const log = require('fancy-log');
const browserify = require('browserify');
const browserSync = require('browser-sync');
const nunjucks = require('nunjucks');
const eslint = require('gulp-eslint');
const consolidate = require('consolidate');
const through = require('through2');
const sass = require('gulp-sass');
const sassLint = require('gulp-sass-lint');
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
const gulp = require('gulp');
const chromeLauncher = require('chrome-launcher');
const lighthouse = require('lighthouse');

const config = require('./config.json');

config.debug = Boolean(minimist(process.argv.slice(2)).production) === false;
config.site.url = config.debug ? 'http://localhost:3000' : config.site.url;

function wrapTemplate(options) {
	options.engine = options.engine || 'nunjucks';
	if (options.requires) {
		consolidate.requires[options.engine] = options.requires;
	}

	return through.obj((file, enc, cb) => {
		const template = typeof options.template === 'function' ? options.template(file) : options.template;
		const data = typeof options.data === 'function' ? options.data(file) : options.data;
		const templatePath = path.join(__dirname, options.templateRoot, template);

		data.content = file.contents.toString();
		consolidate[options.engine](templatePath, data).then(html => {
			file.contents = Buffer.from(html, 'utf8');

			// Change extension to the extension of the template file
			// TODO Create an option to also change the extension when the template is generically named (.html.njk)
			const filename = path.basename(file.path, path.extname(file.path)) + path.extname(templatePath);
			file.path = path.join(path.dirname(file.path), filename);

			cb(null, file);
		}).catch(error => {
			throw error;
		});
	});
}


// --- Linting ---

function lintStyles() {
	log('Linting styles is not implemented yet.');
	return gulp.src([config.source.assets + '**/*.scss', '!' + config.source.vendor + '**/*.scss'])
		.pipe(sassLint())
		.pipe(sassLint.format());
}

function lintScripts() {
	return gulp.src([config.source.assets + '**/*.js', '!' + config.source.vendor + '**/*.js'])
		.pipe(eslint())
		.pipe(eslint.format());
}

function lintTemplates(cb) {
	log('Linting templates is not implemented yet.');
	cb();
}

/**
 * Runs all the linting tasks.
 */
exports.lint = gulp.parallel(lintStyles, lintScripts, lintTemplates);

function watch() {
	browserSync.create();
	browserSync.init(config.browserSync);

	gulp.watch(config.source.assets + '**/*.scss', gulp.series(lintStyles, buildStyles));
	gulp.watch(config.source.assets + '**/*.js', gulp.series(lintScripts, buildStyles));
	gulp.watch(config.source.assets + '**/*.{png,jpg,gif,svg,webp}', buildImages);
	gulp.watch(config.source.assets + '**/*.{ttf,otf,eot,woff,woff2}', buildFonts);
	gulp.watch(config.source.uploads + '**/*', buildUploads);
	gulp.watch(config.source.content + '**/*', buildPages);
	gulp.watch(config.source.templates + '**/*', buildPages);
}

exports.watch = watch;

// --- Build tasks ---

function buildScripts() {
	return gulp.src(config.source.assets + '*.js', {base: config.base.assets, read: false})
		.pipe(tap(file => {
			file.contents = browserify(file.path, {debug: config.debug}).bundle();
		}))
		.pipe(buffer())
		.pipe(config.debug ? sourcemaps.init({loadMaps: true}) : through.obj())
		.pipe(config.debug ? through.obj() : uglify()).on('error', log)
		.pipe(config.debug ? sourcemaps.write('./') : through.obj())
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
}

function buildStyles() {
	return gulp.src([config.source.assets + '**/*.scss'], {base: config.base.assets})
		.pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
		.pipe(config.debug ? through.obj() : cleanCSS({compatibility: 'ie9', format: 'keep-breaks'}))
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream({match: '**/*.css'}));
}

function buildImages() {
	return gulp.src([config.source.assets + '**/*.{png,jpg,gif,svg,webp}'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
}

function buildUploads() {
	return gulp.src([config.source.uploads + '**/*'], {base: config.base.assets})
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
}

function buildFonts() {
	return gulp.src([config.source.assets + '**/*.{ttf,otf}'], {base: config.base.assets})
		.pipe(ttf2woff({clone: true}))
		.pipe(ttf2woff2({clone: true}))
		.pipe(gulp.dest(config.target))
		.pipe(browserSync.stream());
}

function buildPages() {
	return gulp.src([config.source.content + '**/*', '!' + config.source.content + '**/_*'])
		.pipe(frontMatter({property: 'page', remove: true}))
		.pipe(gulpIf(file => {
			return file.path.match(/(\.md|\.markdown)$/) !== null;
		}, markdown(config.markdown)))
		.pipe(gulpIf(file => {
			return !file.isDirectory() && Boolean(file.page.layout);
		}, wrapTemplate({
			template: (file => {
				return file.page.layout;
			}),
			data: file => {
				return {page: file.page, site: config.site};
			},
			engine: 'nunjucks',
			templateRoot: config.source.templates,
			requires: nunjucks.configure(path.join(__dirname, config.source.templates), {
				autoescape: true,
				throwOnUndefined: false,
				trimBlocks: false,
				noCache: true
			})
		})))
		.pipe(gulpIf(file => {
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
}

/**
 * Runs a full build of the project.
 *
 * Cleans the destination folder before building the project. Linting is done
 * by each build task individually.
 *
 * If you want a production run do use this:
 * 		gulp build --type=production
 */
exports.build = gulp.parallel(
	gulp.series(lintStyles, buildStyles),
	gulp.series(lintScripts, buildScripts),
	gulp.series(lintTemplates, buildPages),
	buildImages,
	buildUploads,
	buildFonts
);

/* --- Cleanup --- */

/**
 * Removes everything in the target folder.
 *
 * @returns {object} A promise from the delete command.
 */
function clean() {
	return del([config.target + '**/*']);
}

exports.clean = clean;
exports.default = gulp.series(clean, exports.build);

/* --- Reports --- */

function _runLighthouse(url, cFlags, lhFlags, lhConfig) {
	return chromeLauncher.launch({chromeFlags: cFlags}).then(chrome => {
		lhFlags.port = chrome.port;
		return lighthouse(url, lhFlags, lhConfig).then(results => {
			return chrome.kill().then(() => results);
		});
	});
}

function _processURL(urls, config, callback) {
	if (urls.length === 0) {
		return callback();
	}

	const url = urls.pop();
	_runLighthouse(url, config.chromeFlags, config.lighthouseFlags, config.lighthouseConfig).then(results => {
		const folder = `${config.target}${new Date().toISOString().split('T')[0]}_lighthouse/`;
		const basename = url.replace(/^https?:\/\//, '').replace(/[./]/g, '_');
		const reportFilename = folder + basename + 'lighthouse.' + config.lighthouseFlags.output;

		fs.mkdir(folder, {recursive: true}, error => {
			if (error) {
				log.error(error);
				callback();
			} else {
				fs.writeFile(reportFilename, results.report, error => {
					if (error) {
						log.error(error);
						callback();
					} else { 
						log('Analysis saved to', reportFilename);
						_processURL(urls, config, callback);
					}
				});
			}
		});
	}).catch(error => {
		log.error(error);
		callback();
	});
}

function report(callback) {
	const urls = config.reports.urls.slice(0);
	_processURL(urls, config.reports, callback);
}

exports.report = report;
