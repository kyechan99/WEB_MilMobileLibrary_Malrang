const express = require('express');
const logger = require('morgan');
const app = express();

app.use(logger('dev')); /*   In development   */

app.use('/api/search', require('./routes/api_search'));


const path = require('path');
//const favicon = require('serve-favicon');
//const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
//const methodOverride = require('method-override');

//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public'), {
  immutable: true,
  maxAge: '1y',
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(cookieParser());

//app.use(methodOverride('_method'));

const session = require('express-session');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

app.use(session({
  secret: '@@BR7wr2z_vemApR!3Hl',
  store: new SequelizeStore({
    db: new Sequelize({
      dialect: 'sqlite',
      storage: './db/session.db'
    })
  }),
  resave: false,
  saveUninitialized: true
}));
//sequelize.sync();


app.use('/api', require('./routes/api'));


//const isDev = app.get('env') === 'development';
const isDev = true;

const expressNunjucks = require('express-nunjucks');
app.set('views', path.join(__dirname, 'views'));
expressNunjucks(app, {
  watch: isDev,
  noCache: isDev,
  /*
  filters: {
      json: (value, spaces) => JSON.stringify(value, null, spaces).replace(/</g, '\\u003c')
  }
  */
});


app.use('/', require('./routes/index'));
app.use('/search', require('./routes/search'));
app.use('/book', require('./routes/book'));
app.use('/admin', require('./routes/admin'));
app.use('/user', require('./routes/users'));
app.use('/review', require('./routes/review'));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('components/error');
});

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`Military Mobile Library listening on port ${PORT}!`));

module.exports = app;
