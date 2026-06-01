var express = require('express');
var router = express.Router();
let admin_controllers = require('../controllers/admin_controllers')();
let verify_token = require('../config/helper').verify_token;

router.get('/all-users', admin_controllers.get_all_users);


module.exports = router;
