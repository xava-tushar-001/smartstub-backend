var express = require('express');
var router = express.Router();
let Subscriber = require('../src/users/subscriber/subscriber')();
let Auth = require('../src/users/auth/auth')();
let Profile = require('../src/users/profile/profile')();
let SalarySlip = require('../src/users/salary_slip/salary_slip')();
let Billing = require('../src/users/billing/billing')();
let Payroll = require('../src/users/payroll/payroll')();
let verify_token = require('../helper/helper').verify_token;

// Waitlist / newsletter
router.post('/subscriber', Subscriber.CreateSubscriber);

// Account creation with email OTP
router.post('/register', Auth.Register);
router.post('/verify-otp', Auth.VerifyOtp);
router.post('/resend-otp', Auth.ResendOtp);
router.post('/google-login', Auth.GoogleLogin);

// Password reset with email OTP
router.post('/forgot-password', Auth.ForgotPassword);
router.post('/reset-password', Auth.ResetPassword);

// Profile (protected)
router.get('/profile', verify_token, Profile.GetProfile);
router.put('/profile', verify_token, Profile.UpdateProfile);

// Salary slip analysis (protected)
router.post('/salary-slips', verify_token, SalarySlip.Upload);
router.get('/salary-slips', verify_token, SalarySlip.List);
router.get('/salary-slips/stats', verify_token, SalarySlip.GetStats);
router.get('/salary-slips/:id', verify_token, SalarySlip.GetOne);
router.get('/salary-slips/:id/file', verify_token, SalarySlip.GetFile);
router.post('/salary-slips/:id/retry', verify_token, SalarySlip.Retry);

// Billing (protected)
router.get('/billing/status', verify_token, Billing.GetStatus);
router.post('/billing/checkout', verify_token, Billing.CreateCheckoutSession);
router.post('/billing/portal', verify_token, Billing.CreatePortalSession);

// Payroll integration (protected, Pro-only - enforced inside the controller)
router.post('/payroll/session', verify_token, Payroll.CreateSession);
router.post('/payroll/connect', verify_token, Payroll.Connect);
router.get('/payroll/status', verify_token, Payroll.GetStatus);
router.post('/payroll/disconnect', verify_token, Payroll.Disconnect);
router.post('/payroll/sync', verify_token, Payroll.Sync);
router.get('/payroll/history', verify_token, Payroll.GetHistory);

module.exports = router;
