var ffmpeg = require('fluent-ffmpeg');
var ffprobe = require('node-ffprobe');
var Promise = require('promise');

var vProccesor = {
  APP_VIDEO: {
    WIDTH: 480,
    ASPECT_RATIO: '1:1',
    HEIGHT: 720,
    DURATION: 5,
    HAPPY_BEAT: './audio/upbeat.mp3'
  },

  setAppWidth(i) {
    return ffmpeg(i).size(`${this.APP_VIDEO.WIDTH}x?`).aspect(this.APP_VIDEO.ASPECT_RATIO).autopad(true);
  },

  setAspectRatio(i) {
    var width = this.APP_VIDEO.WIDTH;
    var aspectRatio = this.APP_VIDEO.ASPECT_RATIO;
    return ffmpeg(i)
      .complexFilter([
        `scale=${width}:-1[scaled]`,
        `[scaled]setsar=sar=${aspectRatio}`
      ]);
  },

  concatFiles(listOfFiles, outputFile) {
    var temp = ffmpeg();
    listOfFiles.map((file) => {
      temp.input(file);
    });

    return temp.mergeToFile(outputFile);
  },

  formatAudio(file, volume = 1) {
    return ffmpeg(file).volume(`volume=${volume}`).audioFilters('aformat=sample_fmts=u8|s16:sample_rates=44100:channel_layouts=stereo');
  },

  addNullAudio(file) {
    return ffmpeg(file).input('anullsrc').inputFormat('lavfi').duration(this.APP_VIDEO.DURATION).outputOptions([
      '-c:v copy',
      '-c:a aac',
      '-map 0:v',
      '-map 1:a'
    ]);
  },

  parseMetaData(i) {
    return new Promise(function(resolve, reject) {
      ffprobe(i, function(err, data){
        if (err) {
          reject();
        }
        var metaData = {};
        data.streams.some((current_stream) => {
          if (current_stream.hasOwnProperty('height')) {
            metaData.height = current_stream.height;
            metaData.width = current_stream.width;
            metaData.isPotrait = current_stream.width < current_stream.height;
            resolve(metaData);
            return true;
          }
          return false;
        });
      });
    });
  },

  processPotrait(i) {
    var height = this.APP_VIDEO.HEIGHT;
    var width = this.APP_VIDEO.WIDTH;
    return ffmpeg(i).complexFilter([
      `scale=${width}:${height}[scaled]`,
      `[scaled]setsar=sar=${this.APP_VIDEO.ASPECT_RATIO}`,
    ]);
  },

  processLandScape(i) {
    var width = this.APP_VIDEO.WIDTH;
    var height = this.APP_VIDEO.HEIGHT;
    return ffmpeg(i).complexFilter([
      `scale=${width}:-1[scaled]`,
      `[scaled]setsar=sar=${this.APP_VIDEO.ASPECT_RATIO}[aspect]`,
      `[aspect]pad=${width}:${height}:0:(oh-ih)/2`
    ]);
  },

  overlayBeatAudio(target) {
    var source = this.APP_VIDEO.HAPPY_BEAT;
    return ffmpeg(source).input(target).complexFilter([
      '[0:a]volume=volume=0.1[a1]',
      '[a1]aformat=sample_fmts=u8|s16:sample_rates=44100:channel_layouts=stereo[a3]',
      '[1:a]volume=volume=1[a2]',
      '[a2]aformat=sample_fmts=u8|s16:sample_rates=44100:channel_layouts=stereo[a4]',
      '[a3][a4]amerge=[a5]'
    ]).outputOptions([
      '-c:v copy',
      '-c:a aac',
      '-map 1:v',
      '-map [a5]'
    ]);
  },

  processImageToVideo(i) {
    return ffmpeg(i)
    .inputOptions('-loop 1')
    .input('anullsrc').inputFormat('lavfi')
    .duration(this.APP_VIDEO.DURATION).outputOptions([
      '-c:v libx264',
      '-c:a aac',
      '-map 0:v',
      '-map 1:a'
    ]);
  },

  overlayImageOverVideo(overlay, target) {
    return ffmpeg(target)
      .input(overlay)
      .complexFilter([
        '[0][1]overlay',
      ]);
  },


};


 module.exports = vProccesor;

/**
 * Sample code
 * @type {[type]}
 *
 vProccesor.overlayImageOverVideo('./workstation/processed/dp_template.png', './workstation/processed/io2.mp4')
   .save('./workstation/processed/overlayed.mp4').on('error', function(err, stdout, stderr) {
         console.log(`Cannot process: ${stderr} ${err.message} `);
       });
       return;


vProccesor.processImageToVideo('./workstation/io.jpg').save('./workstation/processed/image.mp4')
.on('error', function(err, stdout, stderr) {
      console.log(`Cannot process: ${stderr} ${err.message} `);
    });
return;

vProccesor.overlayBeatAudio('./workstation/processed/processed.mp4').save('./workstation/processed/mix.mp4')

// ffmpeg('./workstation/io.mp4').size(`480x?`).setAspect('2:3').autopad(true).save('./workstation/processed/1.mp4');
// return
// ffmpeg('./workstation/io.mp4')
//   .complexFilter([
//     'scale=480:-1[scaled]',
//     '[scaled]setsar=sar=2:3'
//   ]).save('./workstation/processed/1.mp4').on('error', function(err, stdout, stderr) {
//         console.log(`Cannot process: ${stderr} ${err.message} `);
//       });
// return;

// vProccesor.setAppWidth('./workstation/processed/io.mp4').save('./workstation/processed/as.mp4');
// return;

// vProccesor.addNullAudio('./workstation/io.mp4').save('./workstation/processed/io.mp4')
// vProccesor.concatFiles(['./workstation/processed/as.mp4', './workstation/processed/processed.mp4'], './workstation/processed/combined.mp4')
//   .on('error', function(err, stdout, stderr) {
//       console.log(`Cannot process: ${stderr} ${err.message} `);
//     })
// .on('end', function(stdout, stderr) {
//     if (stderr) {
//       console.log(`Failed ${stderr}`);
//     } else {
//       console.log(`Transcoding succeeded !`);
//     }
//
//     });

// vProccesor.setAppWidth('./workstation/io3.mp4').save('./workstation/x.mp4')




  // [ 'io.mp4', 'io1.mp4', 'io2.mp4', 'io3.mp4', 'io4.mp4', 'io5.mp4', 'io6.mp4', 'io7.mp4', 'io8.mp4'].map((file) => {
  //   var filePath = `./workstation/${file}`;
  //   var outputFilePath = `./workstation/processed/${file}`;
  //   return vProccesor.parseMetaData(filePath).then((metaData) => {
  //     let handle;
  //     if (metaData.isPotrait) {
  //       handle = vProccesor.processPotrait(filePath).save(outputFilePath);
  //     } else {
  //       handle = vProccesor.processLandScape(filePath).save(outputFilePath);
  //     }
  //     handle.on('error', function(err, stdout, stderr) {
  //       console.log(`Cannot process ${file}:  ${err.message} `);
  //     }).on('end', function(stdout, stderr) {
  //       console.log(`Transcoding ${file} succeeded !`);
  //     });
  //   });
  //
  // });

var list = ['io.mp4','io1.mp4', 'io2.mp4', 'io3.mp4', 'io4.mp4', 'io5.mp4', 'io6.mp4', 'io7.mp4', 'io8.mp4'].map((file) => {
  return `./workstation/processed/${file}`;
});

vProccesor.concatFiles(list, './workstation/processed/processed.mp4')
  .on('error', function(err, stdout, stderr) {
      console.log(`Cannot process:  ${err.message} `);
    })
  .on('end', function(stdout, stderr) {
    if (stderr) {
      console.log(`Failed ${stderr}`);
    } else {
      console.log(`Transcoding succeeded !`);
    }

    });
*/
