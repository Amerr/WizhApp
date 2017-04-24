var gm = require('gm');
var gmImg = require('gm').subClass({imageMagick: true});
var Promise = require('promise');
const IMAGES = {
  gradientImg: './images/code_gradient.png',
  maskImage: './images/code_mask.png',
};

const APP_VIDEO = {
  WIDTH: 480,
  HEIGHT: 720,
  GEOMETRY: '+50+50',
  DP_SIZE: '75x75!',
  TEXT_SIZE: 20,
  TEXT_X: 150,
  TEXT_Y: 80
};

// convert  \( -size 1x400 xc:transparent \) \( -size 1x100 gradient:none-#333 \) -append  -scale 400x400! -quality 100 gradient_transparent.png
function generateGradient() {
  return new Promise(function(resolve, reject) {
    gmImg(1, 400, 'transparent')
      .out('(')
      .out('-size', '1x100')
      .out('gradient:none-#333')
      .out(')')
      .out('-append')
      .out('-scale', `${APP_VIDEO.WIDTH}x${APP_VIDEO.HEIGHT}!`)
      .out('-quality', '100')
      .write('./temp/code_gradient.png', function(err) {
        if(!err) {
          resolve(this.outname);
        } else {
          reject("Failed to create gradient image",err);
        }
      });
  });
}


// convert -size 200x200 xc:blue -fill red -stroke white -strokewidth 10  -draw "circle 100,100 100,6" -transparent red mask1.png
function createMaskImage() {
  return new Promise(function(resolve, reject) {
    gm(200, 200, "blue")
      .fill('red')
      .stroke('white', 10)
      .drawCircle(100, 100, 100, 6)
      .transparent('red')
      .write('./temp/code_mask.png', function(err) {
        if(!err) {
          resolve(this.outname);
        } else {
          reject("Failed to create mask image", err);
        }
      });
  });
}
// createMaskImage();


// convert  profile2.jpg mask1.png -composite  -transparent blue  outputProfile.png
function maskProfileToRounded(profileImg, maskImage) {
  return new Promise(function(resolve, reject) {
    gm(profileImg).resize(200, 200, "!").write('./temp/profile2.png', function(err, value) {
      if (!err) {
        gmImg()
          .command('convert')
          .in(this.outname)
          .in(maskImage)
          .out('-composite')
          .transparent('blue')
          .write('./temp/code_masked_profile.png', function(err) {
            if (!err) {
              resolve(this.outname);
            } else {
              reject("Failed to merge profile and mask image", err);
            }
          });
      } else {
        reject("Failed to resize profile image", err);
      }
    });
  });
}

// gm composite -gravity SOUTHWEST -geometry +50+50 -resize 100x100 dp.png  gradient_transparent.png -resize 500x500! grad_dp3.png
function overlayGradientWithProfile(profileImg, gradientImg) {
  return new Promise(function(resolve, reject) {

    gm()
      .command('composite')
      .in('-gravity', 'SOUTHWEST')
      .in('-geometry', APP_VIDEO.GEOMETRY)
      .in('-resize', APP_VIDEO.DP_SIZE)
      .in(profileImg)
      .in(gradientImg)
      .out('-resize', `${APP_VIDEO.WIDTH}x${APP_VIDEO.HEIGHT}!`)
      .write('./temp/code_gradient_profile.png', function(err) {
        if (!err) {
          resolve(this.outname);
        } else {
          reject("Failed to overlay gradient and masked profile", err);
        }
      });
  });
}
// overlayGradientWithProfile('code_masked_profile.png');

function addTextToGradientTemplate(template, textMsg, outputPath) {
  return new Promise(function(resolve, reject) {
    gm(template)
    .font('./Spirax-Regular.ttf', APP_VIDEO.TEXT_SIZE)
    .fill('#FFFFFF')
    .drawText(APP_VIDEO.TEXT_X, APP_VIDEO.TEXT_Y, textMsg, 'SOUTHWEST')
    .sharpen(50)
    .quality(100)
    .write(outputPath, function(err) {
      if (!err) {
        resolve(this.outname);
      } else {
        reject("Failed to add text to template", err);
      }
    });
  });
}
// addTextToGradientTemplate('code_gradient_profile.png')


// maskProfileToRounded('profile.jpg');

// gm composite -gravity SOUTH -resize 0+0 grad_dp3.png image.png  overlayed.png
function overlayImageWithProfile(userTemplate, uploadedImg) {
  return new Promise(function(resolve, reject) {
    gm(userTemplate).size(function(err, value) {
      gm(uploadedImg).resize( value.width, value.height).write('./temp/uploadedImg_resize.png', function(err) {
        if (!err) {
          gm().command('composite')
            .in('-gravity', 'SOUTH')
            .in(userTemplate)
            .in(this.outname)
            .write('./temp/code_final_output.png', function(err) {
              if(!err) {
                resolve(this.outname);
              } else {
                reject("Failed to overlay template and user image", err);
              }
            });
        } else {
          reject("Error in Resizing Dp", err);
        }
      });
    });

  });
}

// overlayImageWithProfile('code_text_gradient_template.png');

function handleCatch(err) {
  console.log(err);
}

function main(profileImg, textMsg, outputPath) {
  return new Promise(function(resolve, reject) {

    generateGradient().then(function(gradientImg) {

      createMaskImage().then(function(maskImage) {

        maskProfileToRounded(profileImg, maskImage).then(function(roundedProfile) {

          overlayGradientWithProfile(roundedProfile, gradientImg).then(function(gradientTemplate) {

            addTextToGradientTemplate(gradientTemplate, textMsg, outputPath).then(function(finalTemplate) {
              resolve(`${outputPath}/${finalTemplate}`);
            }).catch(handleCatch);

          }).catch(handleCatch);

        }).catch(handleCatch);

      }).catch(handleCatch);

    }).catch(handleCatch);

  });
}

function makeDpTemplate(profileImg, textMsg, outputPath) {
  var gradientImg = IMAGES.gradientImg;
  var maskImage = IMAGES.maskImage;

  return new Promise(function(resolve, reject) {

    maskProfileToRounded(profileImg, maskImage).then(function(roundedProfile) {

      overlayGradientWithProfile(roundedProfile, gradientImg).then(function(gradientTemplate) {

        addTextToGradientTemplate(gradientTemplate, textMsg, outputPath).then(function(finalTemplate) {
          resolve(finalTemplate);
        }).catch(handleCatch);

      }).catch(handleCatch);

    }).catch(handleCatch);

  });
}
//
// main('user1.jpg', 'Nallai allai')
// .then(function(userTemplate) {
//   return overlayImageWithProfile(userTemplate, 'Image.png').then(function(masterOutput) {
//     console.log("Master output", masterOutput);
//   });
// });

module.exports = {
  generateGradient: generateGradient,
  createMaskImage: createMaskImage,
  maskProfileToRounded: maskProfileToRounded,
  overlayGradientWithProfile: overlayGradientWithProfile,
  addTextToGradientTemplate: addTextToGradientTemplate,
  overlayImageWithProfile: overlayImageWithProfile,
  main: main,
  makeDpTemplate: makeDpTemplate
};
