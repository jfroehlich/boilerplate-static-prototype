// jshint node:true
'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var livereload = require('gulp-livereload');
var header = require('gulp-header');
var concat = require('gulp-concat');
var cleanCSS = require('gulp-clean-css');
var sass = require('gulp-sass');
var plumber = require('gulp-plumber');
var mergeStream = require('merge-stream');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var order = require('gulp-order');
var changed = require('gulp-changed');
var uglify = require('gulp-uglify');
var frontMatter = require('gulp-front-matter');
var connect = require('gulp-connect');
var markdown = require('gulp-markdown');
var del = require('del');
var nunjucks = require('nunjucks');
var through = require('through2');
var path = require('path');
var filter = require('gulp-filter');

// --- Config setup ------------------------------------------------------------

var config = {
   pkg: require('./package.json'),
   site: require('./site.json'),
   source: {
       assets: 'source/assets/',
       templates: 'source/templates/',
       content: 'source/content/'
   }
};

// TODO Move this into an file with environment settings
gutil.env.env = gutil.env.env || "development";
config.env = {
   name: gutil.env.env,
   debug: gutil.env.env === 'development',
   compressScripts: gutil.env.env !== 'development',
   compressStyles: gutil.env.env !== 'development',
   renderOnlyChangedFiles: false,
   defaultTemplate: 'layouts/page.html'
};

config.target = {
   project: 'builds/' + config.env.name + '/',
   assets: 'builds/' + config.env.name + '/assets/'
};

nunjucks.configure(config.source.templates, {
   autoescape: true,
   throwOnUndefined: false,
   trimBlocks: true,
   lstripBlocks: false,
   noCache: true
});

// --- Library methods ---------------------------------------------------------

function pad(n) {
   return n < 10 ? '0' + n : n;
}

function getISODateString(date) {
   return date.getFullYear() +
       '-' + pad(date.getMonth() + 1) +
       '-' + pad(date.getDate());
}

function renderWithTemplate() {
   return through.obj(function (file, enc, cb) {
       var templateFile =  path.join(__dirname, config.source.templates, file.page.layout || config.env.defaultTemplate);
       var data = {
           site: config.site,
           env: config.env,
           page: file.page,
           content: file.contents.toString()
       };
       var content = nunjucks.render(templateFile, data);
       var extension = data.page.filetype ? '.'  + data.page.filetype : path.extname(templateFile);

       file.contents = new Buffer(content, 'utf8');
       file.path = gutil.replaceExtension(file.path, extension);
       this.push(file);
       cb();
   });
}

// --- Build Tasks -------------------------------------------------------------

gulp.task('build-scripts', function () {
    var bundles = Object.keys(config.site.scriptBundles);
    var merged = mergeStream();
    bundles.forEach(function (bundleName) {
        var projScripts = filter([config.source.assets + '**/*.js'], {restore: true});
        var scripts = config.site.scriptBundles[bundleName];
        var stream = gulp.src(scripts)
            .pipe(plumber())
            .pipe(projScripts)
            .pipe(jshint('.jshintrc'))
            .pipe(jshint.reporter(stylish))
            .pipe(config.env.compressScripts ? uglify() : gutil.noop())
            .pipe(projScripts.restore)
            .pipe(order(scripts), {base: process.cwd()})
            .pipe(concat(bundleName))
            .pipe(header('/* <%= config.pkg.name %> - <%= config.env.name %> scripts - <%= date %> */\n', {
                config: config,
                date: getISODateString(new Date())
            }))
            .pipe(gulp.dest(config.target.assets));
        merged.add(stream);
    });
    merged.pipe(livereload());
});

gulp.task('build-styles', function () {
   return gulp.src([config.source.assets + '**/*.scss', '!' + config.source.assets + '**/_*.scss'])
       .pipe(plumber())
       .pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
       .pipe(config.env.compressStyles ? cleanCSS({keepBreaks: true, mediaMerging: true, sourceMap: true}) : gutil.noop())
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

gulp.task('build-pages', function () {
   return gulp.src([config.source.content + '/**/*.md'])
       .pipe(frontMatter({property: 'page', remove: true}))
       .pipe(config.env.renderOnlyChangedFiles ? changed(config.target.project, {extension: '.html'}) : gutil.noop())
       .pipe(markdown())
       .pipe(renderWithTemplate())
       .pipe(gulp.dest(config.target.project))
       .pipe(livereload());
});

// --- Management Tasks -----------------------------------------------------------

gulp.task('clean', function() {
   return del(config.target.project + '**/*');
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
       root: config.target.project,
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
   gulp.watch(config.source.templates + '**/*', ['build-pages']);

});
