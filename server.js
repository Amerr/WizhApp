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
    var wid = req.query.wid,
        inDir = path.join(__dirname, '/uploads/' + wid + '/formated'),
        tmpDir = path.join(__dirname, '/uploads/' + wid + '/tmp'),
        beat = path.join(__dirname, '/audio/upbeat.mp3'),
        command = ffmpeg();
      if (!fs.existsSync(tmpDir)) {
        fs.ensureDirSync(tmpDir);
      }
    fs.readdir(inDir, function(err, list) {
        fileFullPath(inDir, list).forEach(function(videoName){
          command = command.addInput(videoName);
          console.log(videoName);
        });
        command.mergeToFile(tmpDir + '/output.mp4', './tmp/')
        .on('error', function(err) {
            console.log('Error ' + err.message);
            res.status(500);
            res.json({
                'success': false
            });
        })
        .on('end', function() {
            console.log('Finished!');
            var status = renderVideo(tmpDir , wid);
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

function renderVideo(filePath, wid){
    var beat = path.join(__dirname, '/audio/upbeat.mp3'),
        outDir = path.join(__dirname, '/output/' + wid);
    if (!fs.existsSync(outDir)) {
        fs.ensureDirSync(outDir);
      }
    ffmpeg(filePath+ '/output.mp4')
      .addInput(beat)
      .complexFilter([
        {
          filter: 'amerge',
          options: [2],
          inputs:['0:a', '1:a,volume=0.1'],
          outputs: 'audio'
        }
      ])
      .outputOptions([
        '-map 0:v',
        '-c:v libx264',
        '-map [audio]',
        '-c:a mp3',
        '-b:a 128K'
      ])
      .output(outDir + '/output.mp4')
      .on('error', function(err) {
          console.log('Error ' + err.message);
          return "error";
      })
      .on('end', function() {
          console.log('Finished!');
          return "success";
      })
      .run();
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
    videoWatermark(uid, wid, fileName);
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
    imageToVideo(uid, wid, fileName);
  }
  if (req.body.r_type == "audio"){
    var file = req.files.a_file,
        fileExt = file.name.split('.').pop(),
        fileName = uid + '.' + fileExt,
        image = req.files.i_file,
        imageExt = image.name.split('.').pop(),
        imageName = uid + '_image'+ '.' + imageExt;
    if (!fs.existsSync(dir)){
      fs.ensureDirSync(dir);
    }
    file.mv(dir + '/' + fileName, function(err) {
      if (err) {
        return res.status(500).send({ msg: 'Error occurend during image file upload', err: err });
      }
    });
    image.mv(dir + '/' + imageName, function(err) {
      if (err) {
        return res.status(500).send({ msg: 'Error occurend during image file upload', err: err });
      }
    });
    // images = [];
    // range(1,imageCount,'inclusive').forEach(function(count){
    //   var imageFile = req.files["image_"+count],
    //       ext = imageFile.name.split('.').pop(),
    //       name = uid + '_image_' + count + '.' + imageExt;
    //   images.push(name);
    //   imageFile.mv(dir + '/' + name, function(err) {
    //     if (err) {
    //       return res.status(500).send({ msg: 'Error occurend during image file upload', err: err });
    //     }
    //   });
    // });
    audioToVideo(uid, wid, imageName, fileName);
  }
  dp.mv(dir + '/' + dpName, function(err) {
    if (!err) {
      return res.send({msg: 'Files uploaded successfully'});
    } else {
      return res.status(500).send({ msg: 'Error occurend during DP image upload', err: err });
    }
  });
  // sample(dir + '/' + dpName, text);
});

function sample(image, text) {
  ImageGraphics.main(image, text).then(function(){
    console.log("generated")
  }).catch(function(err){
    console.log(err);
  });
}


function imageToVideo(uid,wid,image){
  var inDir = path.join(process.env.PWD, '/uploads/', wid, '/rawinputs/', uid),
      outDir = path.join(process.env.PWD, '/uploads/', wid, '/formated');
  if (!fs.existsSync(outDir)){
      fs.ensureDirSync(outDir);
    }
  ffmpeg(inDir + '/' + image)
    .loop(5)
    .withSize('800x1200')
    .videoCodec('libx264')
    .input('anullsrc=r=48000:cl=mono')
    .inputFormat('lavfi')
    .audioCodec('libmp3lame')
    .format('mp4')
    .output(outDir + '/'+ uid +'.mp4')
    .on('error', function(err) {
        console.log('Error ' + err.message);
        return "error";
    })
    .on('end', function() {
      console.log('Finished!');
      return "success";
    })
    .run();
}


function videoWatermark(uid,wid,video){
  var inDir = path.join(process.env.PWD, '/uploads/', wid, '/rawinputs/', uid),
      outDir = path.join(process.env.PWD, '/uploads/', wid, '/formated'),
      intrFile = inDir + 'intr.mp4'
      wmimage = inDir + '/code_text_gradient_template.png';
  if (!fs.existsSync(outDir)){
      fs.ensureDirSync(outDir);
    }
  ffmpeg(inDir + '/' + video)
    .size('800x1200')
    .videoCodec('libx264')
    .saveToFile(intrFile)
    .on('error', function(err) {
      console.log('Error ' + err.message);
      return "error";
    })
    .on('end', function() {
      console.log('Finished!');
      ffmpeg(intrFile)
        .videoCodec('libx264')
        .videoFilter(["movie="+ wmimage +" [watermark]; [in][watermark] overlay=main_w-overlay_w-1:main_h-overlay_h+2 [out]"])
        .output(outDir + '/'+ uid +'.mp4')
        .on('error', function(err) {
          console.log('Error ' + err.message);
          return "error";
        })
        .on('end', function() {
          console.log('Finished!');
          return "success";
        })
        .run();
      return "success";
    })
}


function audioToVideo(uid, wid, image, audio){
  var command = ffmpeg(),
      inDir = path.join(process.env.PWD, '/uploads/', wid, '/rawinputs/', uid),
      outDir = path.join(process.env.PWD, '/uploads/', wid, '/formated');
  ffmpeg(inDir + '/' + audio)
  .ffprobe(0, function(err, data) {
    ffmpeg(inDir + '/' + image)
    .loop(data.format.duration)
    .input(inDir + '/' + audio)
    .outputOptions([
      '-c:v libx264',
      '-c:a mp3',
      '-b:a 192k',
      '-s 800x1200'
    ])
    .saveToFile(outDir + '/'+ uid +'.mp4')
    .on('error', function(err) {
      console.log('Error ' + err.message);
      return "error";
    })
    .on('end', function() {
      console.log('Finished!');
      return "success";
    });
  });
}