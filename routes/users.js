var express = require('express');
var router = express.Router();
let Subscriber = require('../src/users/subscriber/subscriber')();
let verify_token = require('../helper/helper').verify_token;

router.post('/subscriber', Subscriber.CreateSubscriber);


module.exports = router;
