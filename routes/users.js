var express = require('express');
var router = express.Router();
let Subscriber = require('../src/users/subscriber/subscriber')();
let Auth = require('../src/users/auth/auth')();
let Profile = require('../src/users/profile/profile')();
let SalarySlip = require('../src/users/salary_slip/salary_slip')();
let verify_token = require('../helper/helper').verify_token;

// Waitlist / newsletter
router.post('/subscriber', Subscriber.CreateSubscriber);

// Account creation with email OTP
router.post('/register', Auth.Register);
router.post('/verify-otp', Auth.VerifyOtp);
router.post('/resend-otp', Auth.ResendOtp);
router.post('/google-login', Auth.GoogleLogin);

// Profile (protected)
router.get('/profile', verify_token, Profile.GetProfile);
router.put('/profile', verify_token, Profile.UpdateProfile);

// Salary slip analysis (protected)
router.post('/salary-slips', verify_token, SalarySlip.Upload);
router.get('/salary-slips', verify_token, SalarySlip.List);
router.get('/salary-slips/:id', verify_token, SalarySlip.GetOne);
router.get('/salary-slips/:id/file', verify_token, SalarySlip.GetFile);

module.exports = router;
