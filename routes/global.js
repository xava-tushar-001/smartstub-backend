var express = require('express');
var router = express.Router();
// let global_controller = require('../controllers/global_controllers')();
let verify_token = require('../helper/helper').verify_token;

// router.post('/upload-image', global_controller.upload_image);
// router.post('/update-image', verify_token, global_controller.update_image);

module.exports = router;
