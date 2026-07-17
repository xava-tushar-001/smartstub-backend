var express = require('express');
var router = express.Router();
let Subscriber = require('../src/users/subscriber/subscriber')();
let Auth = require('../src/users/auth/auth')();
let Profile = require('../src/users/profile/profile')();
let verify_token = require('../helper/helper').verify_token;

// Waitlist / newsletter
router.post('/subscriber', Subscriber.CreateSubscriber);

// Account creation with email OTP
router.post('/register', Auth.Register);
router.post('/verify-otp', Auth.VerifyOtp);
router.post('/resend-otp', Auth.ResendOtp);

// Profile (protected)
router.get('/profile', verify_token, Profile.GetProfile);
router.put('/profile', verify_token, Profile.UpdateProfile);

module.exports = router;
