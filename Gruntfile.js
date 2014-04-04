module.exports = function (grunt) {
    var bannerContent = '/* \n' +
        ' * <%= pkg.name %> v<%= pkg.version %> \n' +
        ' * Author: @<%= pkg.author %> \n' +
        ' * Date: <%= grunt.template.today("yyyy-mm-dd") %> \n' +
        ' * Url: <%= pkg.url %> \n' +
        ' * Licensed under the <%= pkg.license %> license\n' +
        ' */\n';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        uglify: {
            options: {
                banner: bannerContent
            },
            target: {
                src: ['main.js'],
                dest: 'dist/main.min.js'
            }
        },

        cssmin: {
            minify: {
                src: 'style.css',
                dest: 'dist/style.min.css'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');

    grunt.registerTask('default', ['uglify', 'cssmin']);
};
