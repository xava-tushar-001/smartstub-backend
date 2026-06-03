var express = require('express');
var router = express.Router();
let admin_controllers = require('../controllers/admin_controllers')();
let verify_token = require('../config/helper').verify_token;

router.get('/subscriber-list', admin_controllers.GetSubscriber);
router.post('/login', admin_controllers.LoginAdmin);

module.exports = router;
