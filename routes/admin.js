var express = require('express');
var router = express.Router();
let AdminAuth = require('../src/admin/auth/auth')();
let Subscriber = require('../src/admin/subscriber/subscriber')();
let User = require('../src/admin/user/user')();
let Analytics = require('../src/admin/analytics/analytics')();
let Profile = require('../src/users/profile/profile')();
let verify_token = require('../helper/helper').verify_token;
let verify_admin = require('../helper/helper').verify_admin;

// Auth
router.post('/login', AdminAuth.LoginAdmin);

// Dashboard analytics (admin only)
router.get('/dashboard-stats', verify_admin, Analytics.GetDashboardStats);

// Subscriber (admin only)
router.get('/subscriber-list', verify_admin, Subscriber.GetSubscriber);
router.get('/subscriber-graph', verify_admin, Subscriber.SubscriberGraph);

// Users (admin only)
router.get('/user-list', verify_admin, User.GetUsers);
router.get('/users/:id', verify_admin, User.GetUserDetail);
router.get('/users/:id/payments', verify_admin, User.GetUserPayments);
router.get('/users/:id/salary-slips', verify_admin, User.GetUserSalarySlips);
router.get('/users/:id/salary-slips/:slipId/file', verify_admin, User.GetUserSalarySlipFile);

// Profile (protected)
router.get('/profile', verify_token, Profile.GetProfile);
router.put('/profile', verify_token, Profile.UpdateProfile);

module.exports = router;
