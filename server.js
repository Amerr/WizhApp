/*
 * NodeJS code.
 */
// Required modules.
var express = require('express'),
    http = require('http'),
    formidable = require('formidable'),
    fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    ffmpeg = require('fluent-ffmpeg');

var app = express(),
    uploadPath = path.join(__dirname, '/uploads');

var server = app.listen(8000, function() {
    console.log('Server listening on port 8000');
});

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.get('/compile', function(req, res) {
    var user = req.query.user;
    var dir = path.join(__dirname, '/output/' + user);
    var inDir = path.join(__dirname, '/uploads/' + user);
    var beat = path.join(__dirname, '/audio/upbeat.mp3');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    fs.readdir(inDir, function(err, list) {
        var operator = concatOperator(list, concatInput(inputFileConcat(fileFullPath(inDir, list))));
        var cmd = conctatOutput(operator, dir);
        exec(cmd, function(error, stdout, stderr) {
            if (error) {
                res.status(500);
                res.json({
                    'success': false
                });
            } else {
                res.status(200);
                res.json({
                    'success': true
                });
            }
        });
    });
});

app.get('/render', function(req, res) {
    var user = req.query.user,
        dir = path.join(__dirname, '/output/' + user),
        inDir = path.join(__dirname, '/uploads/' + user),
        beat = path.join(__dirname, '/audio/upbeat.mp3'),
        command = ffmpeg();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    fs.readdir(inDir, function(err, list) {
        fileFullPath(inDir, list).forEach(function(videoName){
            command = command.addInput(videoName);
        });
        command.mergeToFile(dir + '/fluent_output.mp4')
        .on('error', function(err) {
            console.log('Error ' + err.message);
            res.status(500);
            res.json({
                'success': false
            });
        })
        .on('end', function() {
            console.log('Finished!');
            res.status(200);
            res.json({
                'success': true
            });
        });
    });
});

function fileFullPath(path, list) {
    return list.map(function(item) {
        return path + "/" + item;
    })
}


function inputFileConcat(list) {
    return list.map(function(i) {
        return "-i " + i;
    }).join(' ')
}

function concatInput(input) {
    return 'ffmpeg ' + input;
}

function concatOperator(list, input) {
    var inputList = list.map(function(i, index) {
        return '[' + index + ']'
    }).join(' ');
    var filter = inputList + ' concat=n=' + list.length + ':v=1:a=1 [v1] [a1]';
    return input + ' -filter_complex "' + filter + '" -map "[v1]"  -c:v libx264 -map "[a1]" -c:a aac -b:a 90k';
}

function conctatOutput(input, dir) {
    return input + ' -strict -2 -y ' + dir + '/cmd_output.mp4'
}

app.post('/upload', function(req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        // `file` is the name of the <input> field of type `file`
        var user = fields.user,
            userPath = uploadPath + '/' + user;
        if (!fs.existsSync(userPath)) {
            fs.mkdirSync(userPath);
        };
        var old_path = files.file.path,
            file_size = files.file.size,
            file_ext = files.file.name.split('.').pop(),
            index = old_path.lastIndexOf('/') + 1,
            file_name = old_path.substr(index),
            new_path = path.join(process.env.PWD, '/uploads/', user, file_name + '.' + file_ext);

        fs.readFile(old_path, function(err, data) {
            fs.writeFile(new_path, data, function(err) {
                fs.unlink(old_path, function(err) {
                    if (err) {
                        res.status(500);
                        res.json({
                            'success': false
                        });
                    } else {
                        res.status(200);
                        res.json({
                            'success': true
                        });
                    }
                });
            });
        });
    });
});