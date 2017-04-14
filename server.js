/*
 * NodeJS code.
 */
// Required modules.
var express = require('express');
var http = require('http');
var formidable = require('formidable');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var exec = require('child_process').exec;
var ffmpeg = require('fluent-ffmpeg');
var fileUpload = require('express-fileupload');

var app = express();

app.use(fileUpload());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());


var uploadPath = path.join(__dirname, '/uploads');

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
        command.mergeToFile(dir + '/tmp_output.mp4', './tmp/')
        .on('error', function(err) {
            console.log('Error ' + err.message);
        })
        .on('end', function() {
            console.log('Finished!');
            var status = addText(dir , user);
            if (status=="success"){
                res.status(200);
                res.json({
                    'success': true
                });
            } else{
                res.status(500);
                res.json({
                    'success': false
                });
            }

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

function addText(filePath, user){
    var beat = path.join(__dirname, '/audio/upbeat.mp3'),
        font = path.join(__dirname, '/font/Roboto-Medium.ttf');
    ffmpeg(filePath+ '/tmp_output.mp4')
    .complexFilter([
      {
        filter: 'drawtext',
        options: {
          fontfile: font,
          text: 'Happy Birthday '+ user,
          fontsize: 40,
          fontcolor: 'white',
          x: '(w-text_w)/2',
          y: '((h-text_h)/2 + 300 )',
          shadowcolor: 'black',
          shadowx: 2,
          shadowy: 2
        },
        outputs: 'output'
      }
    ], 'output')
    .saveToFile(filePath + '/output.mp4')
    .on('error', function(err) {
        console.log('Error ' + err.message);
        return "error";
    })
    .on('end', function() {
        console.log('Finished!');
        return "success";
    });
}

app.post('/upload', function(req, res) {
    if(!req.files) {
      return res.status(400).send({ msg: 'No files were uploaded' });
    }
    var file = req.files.file;

    var dir = path.join(process.env.PWD, '/uploads/', req.body.user);

    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }

    var fileName = Date.now() + file.name;

    file.mv(dir + '/' + fileName, function(err) {
      if (!err) {
        return res.send({msg: 'File uploaded successfully'});
      } else {
        return res.status(500).send({ msg: 'Error occurend during file upload', err: err });
      }
    });
});
