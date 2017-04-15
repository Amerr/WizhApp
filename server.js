/*
 * NodeJS code.
 */
// Required modules.
var express = require('express');
var http = require('http');
var formidable = require('formidable');
// var fs = require('fs');
var fs = require("fs-extra");
var path = require('path');
var bodyParser = require('body-parser');
var exec = require('child_process').exec;
var ffmpeg = require('fluent-ffmpeg');
var fileUpload = require('express-fileupload');
var range = require("range-function");
var ImageGraphics = require('./gm-node');

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
  var wid = req.body.wid,
      uid = req.body.uid,
      text = req.body.text,
      dp = req.files.dp_image,
      dir = path.join(process.env.PWD, '/uploads/', wid, '/rawinputs/', uid),
      imageExt = dp.name.split('.').pop(),
      dpName = uid + '_dp.' + imageExt;
  if (!fs.existsSync(dir)){
    fs.ensureDirSync(dir);
  }
  if (req.body.r_type == "video"){
    var file = req.files.v_file,
        fileExt = file.name.split('.').pop(),
        fileName = uid + '.' + fileExt;
    file.mv(dir + '/' + fileName, function(err) {
      if (err) {
        return res.status(500).send({ msg: 'Error occurend during video file upload', err: err });
      }
    });
  }
  if (req.body.r_type == "image"){
    var file = req.files.i_file,
        fileExt = file.name.split('.').pop(),
        fileName = uid + '.' + fileExt;
    file.mv(dir + '/' + fileName, function(err) {
      if (err) {
        return res.status(500).send({ msg: 'Error occurend during image file upload', err: err });
      }
    });
  }
  if (req.body.r_type == "audio"){
    var imageCount = req.body.no,
        file = req.files.a_file,
        fileExt = file.name.split('.').pop(),
        fileName = uid + '.' + fileExt,
        imageExt = dp.name.split('.').pop();
    if (!fs.existsSync(dir)){
      fs.ensureDirSync(dir);
    }
    file.mv(dir + '/' + fileName, function(err) {
      if (err) {
        return res.status(500).send({ msg: 'Error occurend during image file upload', err: err });
      }
    });
    range(1,imageCount,'inclusive').forEach(function(count){
      var imageFile = req.files["image_"+count],
          ext = imageFile.name.split('.').pop(),
          name = uid + '_image_' + count + '.' + imageExt;

      imageFile.mv(dir + '/' + name, function(err) {
        if (err) {
          return res.status(500).send({ msg: 'Error occurend during image file upload', err: err });
        }
      });
    });
  }
  dp.mv(dir + '/' + dpName, function(err) {
    if (!err) {
      return res.send({msg: 'Files uploaded successfully'});
    } else {
      return res.status(500).send({ msg: 'Error occurend during DP image upload', err: err });
    }
  });
});

function sample() {
  ImageGraphics.generateGradient();
}
