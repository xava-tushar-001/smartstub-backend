var express = require('express');
var router = express.Router();
let AdminAuth = require('../src/admin/auth/auth')();
let Subscriber = require('../src/admin/subscriber/subscriber')();
let User = require('../src/admin/user/user')();
let Profile = require('../src/users/profile/profile')();
let verify_token = require('../helper/helper').verify_token;

// Auth
router.post('/login', AdminAuth.LoginAdmin);

// Subscriber (protected)
router.get('/subscriber-list', verify_token, Subscriber.GetSubscriber);
router.get('/subscriber-graph', verify_token, Subscriber.SubscriberGraph);

// Users (protected)
router.get('/user-list', verify_token, User.GetUsers);

// Profile (protected)
router.get('/profile', verify_token, Profile.GetProfile);
router.put('/profile', verify_token, Profile.UpdateProfile);

module.exports = router;
