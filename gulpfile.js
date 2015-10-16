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
var connect = require('gulp-connect');
var del = require('del');
var swig = require('swig');
var through = require('through2');
var path = require('path');

// --- Config setup ------------------------------------------------------------

var config = {
    pkg: require('./package.json'),
};

config.source = {
    assets: 'assets/',
    templates: 'templates/',
    content: 'content/'
};

config.site = require('./site.json');

// TODO Move this into an file with environment settings
config.env = {
    name: gutil.env.env ? gutil.env.env : "development",
    debug: gutil.env === "development",
    compressScripts: true,
    compressStyles: true,
    vendorScripts: [
        // config.source.assets + 'vendor/jquery/dist/jquery.min.js'
    ],
    defaultCategory: "general",
    projectScripts: [
        config.source.assets + 'main.js'
    ]
};

config.target = {
    project: 'builds/' + config.env.name + '/', 
    assets: 'builds/' + config.env.name + '/assets/'
};

swig.setDefaults({
    loader: swig.loaders.fs(path.join(__dirname, config.source.templates)),
    cache: false
})

// --- Library methods ---------------------------------------------------------

function pad(n) {
    return n < 10 ? '0' + n : n;
}

function getISODateString(date) {
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate());
}

// Inspired by http://www.rioki.org/2014/06/09/jekyll-to-gulp.html
function renderWithTemplate(defaultTemplate) {
    return through.obj(function (file, enc, cb) {
        var templateFile =  path.join(__dirname, config.source.templates, file.page.layout || defaultTemplate);
        var tpl = swig.compileFile(templateFile);
        var data = {
            site: config.site,
            env: config.env,
            page: file.page,
            content: file.contents.toString()
        };
        file.contents = new Buffer(tpl(data), 'utf8');
        this.push(file);
        cb();
    });
}

// Inspired by http://blog.crushingpennies.com/a-static-site-generator-with-gulp-proseio-and-travis-ci.html
function collectPosts() {
    var posts = [];
    var tags = [];
    var categories = [];

    // TODO Add categories

    return through.obj(function (file, enc, cb) {
        // TODO Let the file path be defined by the config and split the date
        file.page.url = 'posts/' + path.basename(file.path, '.md');

        if (file.page.tags) {
            file.page.tags.forEach(function (tag) {
                if (tags.indexOf(tag) === -1) {
                    tags.push(tag);
                }
            });
        }

        file.page.category = file.page.category || config.env.defaultCategory;
        if (categories.indexOf(file.page.category) === -1) {
            categories.push(file.page.catgory);
        }

        posts.push(file.page);

        this.push(file);
        cb();
    },
    function (callback) {
        posts.sort(function (a, b) {
            return b.date - a.date;
        });
        config.site.posts = posts;
        config.site.tags = tags;
        config.site.categories = categories;
        callback();
    });
}

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
        .pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
        .pipe(config.env.compressStyles ? minifyCSS({keepBreaks: true, mediaMerging: true, sourceMap: true}) : gutil.noop())
        .pipe(header('/* <%= config.pkg.name %> - <%= config.env.name %> styles - <%= date %> */\n', {
            config: config,
            date: getISODateString(new Date())
        }))
        .pipe(gulp.dest(config.target.assets))
        .pipe(livereload());
});

gulp.task('build-static', function () {
    return gulp.src([config.source.assets + '/**/*.{gif,jpg,png,pdf,woff,ttf,eot}'])
        .pipe(plumber())
        .pipe(changed(config.target.assets))
        .pipe(gulp.dest(config.target.assets))
        .pipe(livereload());
});

gulp.task('build-posts', function () {
    return gulp.src([config.source.content + '/posts/**/*.md'])
        .pipe(frontMatter({property: 'page', remove: true}))
        .pipe(collectPosts())
        .pipe(renderWithTemplate('layouts/post.html'))
        .pipe(gulp.dest(config.target.project))
});

gulp.task('build-pages', ['build-posts'], function () {
    return gulp.src([config.source.content + '/pages/**/*.md'])
        .pipe(frontMatter({property: 'page', remove: true}))
        .pipe(renderWithTemplate('layouts/page.html'))
        .pipe(rename({extname: '.html'}))
        .pipe(gulp.dest(config.target.project))
        .pipe(livereload());
});

// --- Management Tasks -----------------------------------------------------------

gulp.task('clean', function() {
    del.sync(config.target.project + '**/*');
});

gulp.task('build', ['clean'], function () {
    return gulp.start(
        'build-static', 
        'build-styles', 
        'build-scripts', 
        'build-pages'
    );
});

gulp.task('default', function () {
    return gulp.start('build');
});

gulp.task('serve', function() {
    if (config.env.name !== 'development') {
        console.log('Development in production mode is discouraged.');
        return;
    }
    connect.server({
        port: 8000,
        root: target.main,
        livereload: false
    });
});

gulp.task('develop', ['build', 'serve'], function () {
    if (config.env.name !== 'development') {
        console.log('Development in production mode is discouraged.');
        return;
    }

    livereload({port: 35729, start: true, liveCSS: false, liveJS: false});

    gulp.watch(config.source.assets + '**/*.js', ['build-scripts']);
    gulp.watch(config.source.assets + '**/*.scss', ['build-styles']);
    gulp.watch(config.source.assets + '**/*.{gif,jpg,png,pdf,woff,ttf,eot}', ['build-static']);

    gulp.watch(config.source.content + '**/*.md', ['build-pages']);
    gulp.watch(config.source.templates + '**/*.html', ['build-pages']);
});
