require("dotenv").config();
require('./server')
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const fileUpload = require('express-fileupload')
var cors = require('cors')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var global_router = require('./routes/global');
var admin_router = require('./routes/admin');
var stripeWebhook = require('./src/webhooks/stripe_webhook');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
// Stripe needs the raw, unparsed body to verify the webhook signature -
// this must be registered before express.json() below.
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 }, abortOnLimit: true })); // 10MB
app.use(cors("*"))

app.use('/', indexRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/gl', global_router);
app.use('/api/v1/admin', admin_router);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

const port = process.env.PORT || 5600;
app.listen(port, () => {
  console.log(`App is working on port ${port}`);
});


module.exports = app;
  