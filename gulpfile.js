 // jshint node:true
'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var livereload = require('gulp-livereload');
var header = require('gulp-header');
var concat = require('gulp-concat');
var minifyCSS = require('gulp-minify-css');
var sass = require('gulp-sass');
var plumber = require('gulp-plumber');
var mergeStream = require('merge-stream');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var order = require('gulp-order');
var changed = require('gulp-changed');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var frontMatter = require('gulp-front-matter');
var del = require('del');


// --- Library methods ---------------------------------------------------------

function pad(n) {
	return n < 10 ? '0' + n : n; 
}

function getISODateString(date) {
	return date.getFullYear() +
		'-' + pad(date.getMonth() + 1) +
		'-' + pad(date.getDate());
}


// --- Config setup ------------------------------------------------------------

var config = {
	pkg: require('./package.json'),	
};

config.source = {
    assets: 'source/assets/',
    templates: 'source/templates/',
    content: 'source/content/'
};

config.env = {
    name: gutil.env.env ? gutil.env.env : "development",
    compressScripts: true,
    compressStyles: true,
    vendorScripts: [],
    projectScripts: [
        config.source.assets + 'main.js'
    ]
};

config.target = {
    project: 'builds/' + config.env.name + '/', 
    assets: 'builds/' + config.env.name + '/assets/'
};



// --- Build Tasks -------------------------------------------------------------

gulp.task('build-scripts', function () {
	var vendorScriptStream = gulp.src(config.env.vendorScripts);
	var projectScriptStream = gulp.src(config.env.projectScripts)
		.pipe(plumber())
		.pipe(jshint('.jshintrc'))
		.pipe(jshint.reporter(stylish))
		.pipe(config.env.compressScripts ? uglify() : gutil.noop());
	
	return mergeStream(vendorScriptStream, projectScriptStream)
		.pipe(plumber())
		.pipe(order([].concat(config.env.vendorScripts).concat(config.env.projectScripts), {base: process.cwd()}))
		.pipe(concat('main.js'))
		.pipe(header('/* <%= config.pkg.name %> - <%= config.env.name %> scripts - <%= date %> */\n', {
			config: config,
			date: getISODateString(new Date())
		}))
		.pipe(gulp.dest(config.target.assets))
		.pipe(livereload());
});

gulp.task('build-styles', function () {
	return gulp.src([config.source.assets + '**/*.scss', '!' + config.source.assets + '**/_*.scss'])
		.pipe(plumber())
		.pipe(sass({outputStyle: 'expanded'}))
		.pipe(config.env.compressStyles ? minifyCSS({keepBreaks: true, mediaMerging: true, sourceMap: true}) : gutil.noop())
		.pipe(header('/* <%= config.pkg.name %> - <%= config.env.name %> styles - <%= date %> */\n', {
			config: config,
			date: getISODateString(new Date())
		}))
		.pipe(gulp.dest(config.target.assets))
		.pipe(livereload());
});

gulp.task('build-static', function () {
	return gulp.src([config.source.assets + '/**/*.{gif,jpg,png}'])
		.pipe(plumber())
		.pipe(changed(config.target.assets))
		.pipe(gulp.dest(config.target.assets))
		.pipe(livereload());
});

gulp.task('build-pages', function () {
	return gulp.src([config.source.content + '/**/*.md'])
        .pipe(frontMatter({property: 'page', remove: true}))
		.pipe(gulp.dest(config.target.project))
		.pipe(livereload());
});


// --- Management Tasks -----------------------------------------------------------

gulp.task('clean', function() {
	del.sync(config.target.project + '**/*');
});

gulp.task('build', ['clean'], function () {
	return gulp.start('build-static', 'build-styles', 'build-scripts', 'build-pages');
});

gulp.task('default', function () {
	return gulp.start('build');
});

gulp.task('develop', ['build'], function () {
	if (config.env.name !== 'development') {
		console.log('Development in production mode is discouraged.');
		return;
	}

	livereload.listen({port: 35729});

	gulp.watch(config.source.assets + '**/*.js', ['build-scripts']);
	gulp.watch(config.source.assets + '**/*.scss', ['build-styles']);
	gulp.watch(config.source.assets + '**/*.{gif,jpg,png}', ['build-static']);
});


