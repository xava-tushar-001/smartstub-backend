var express = require('express');
var router = express.Router();
let user_controllers = require('../controllers/user_controllers')();
let verify_token = require('../config/helper').verify_token;

router.post('/create', user_controllers.create_user);
router.post('/login', user_controllers.login_user);

module.exports = router;
