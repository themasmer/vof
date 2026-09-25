const fs = require('fs');

    var today = new Date().toISOString().slice(0, 10);
    var homepath = '/root/.jitsi-meet-cfg/jibri/recordings/';

    //var files = fs.readdirSync(path).filter(fn => fn.includes(today));
    var dirs = fs.readdirSync(homepath).filter(function (file) {return fs.statSync(homepath+'/'+file).isDirectory();});

    dirs.map(function (dirs) {
        var path = homepath + "/" + dirs;
        console.log(path);

        var files = fs.readdirSync(path).filter(fn => fn.includes(today));
        files.map(function (name) {
            const stats = fs.statSync(path + "/" + name);
            const birthtime = new Date(stats.birthtime);
            const fileSize =  stats.size/(1024*1024);
            results.push({Filename:name, Created:birthtime, Size:fileSize})
        });

    });

