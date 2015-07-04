/**
 * Gulp is used to be able to use ES6 when developing but to publish ES5 to NPM.
 */
var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var plumber = require('gulp-plumber');
var notify = require('gulp-notify');
var jshint = require('gulp-jshint');
var path = require('path');

var src = 'src/**/*.js';
var srcRoot = path.join(__dirname, 'src');
var dist = 'dist';

gulp.task('build', function() {
    return gulp.src(src)
        .pipe(jshint('.jshintrc'))
        .pipe(jshint.reporter('jshint-stylish'))
        .pipe(sourcemaps.init())
        .pipe(babel())
        .pipe(sourcemaps.write('.', {
            sourceRoot: srcRoot
        }))
        .pipe(gulp.dest(dist));
});

gulp.task('build:dev', function() {
    return gulp.src(src)
        .pipe(plumber(({
            errorHandler: notify.onError('<%= error.message %>')
        })))
        .pipe(jshint('.jshintrc'))
        .pipe(jshint.reporter('jshint-stylish'))
        .pipe(sourcemaps.init())
        .pipe(babel())
        .pipe(sourcemaps.write('.', {
            sourceRoot: srcRoot
        }))
        .pipe(gulp.dest(dist));
});

gulp.task('dev', function() {
    gulp.watch(src, [ 'build:dev' ]);
});
