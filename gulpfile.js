var fs = require('fs'),
    gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    browserify = require('browserify'),
    banner = require('browserify-banner'),
    git = require('gulp-git');

var version = JSON.parse(fs.readFileSync('package.json')).version;

var revnum;
gulp.task('revnum', function(cb) {
    return git.revParse({args: '--short HEAD'}, function (err, hash) {
        revnum = hash;
        cb();
    });
});

gulp.task('build', ['revnum'], function() {
    return browserify('src/index.js')
        .plugin(banner, {
          banner: `window.polygon_tools_version = '${version}';\nwindow.polygon_tools_rev = '${revnum}';`
        })
        .transform('babelify').bundle()
        .pipe(source('polygon-tools.min.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('./build'));
});

gulp.task('default', ['build']);
