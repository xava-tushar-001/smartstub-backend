var express = require('express');
var router = express.Router();
let AdminAuth = require('../src/admin/auth/auth')();
let Subscriber = require('../src/admin/subscriber/subscriber')();
let verify_token = require('../helper/helper').verify_token;

router.post('/login-admin', AdminAuth.LoginAdmin);


// Subscriber
router.get('/subscriber-list', Subscriber.GetSubscriber);
router.get('/subscriber-graph', Subscriber.SubscriberGraph);

module.exports = router;
