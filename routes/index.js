var express = require('express');
var router = express.Router();

const sqlite3 = require('sqlite3-promisify');
const db = new sqlite3('./db/store.db');

const config = require('../config.json')

const { Client } = require('@elastic/elasticsearch')
const client = new Client(config.elastic)

// 메인_GET
router.get('/', async (req, res, next) => {
  sess = req.session
  title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'
  let i = 0, ttt;
  if (sess.user) {
    let r = await db.all('SELECT * FROM rental WHERE serial_num=? AND isReturned=0', sess.user.serial_num);
    let now = +new Date();
    for (let a of r) {
      // 14일 연체
      if (now - a.borrow_date >= 1000 * 60 * 60 * 24 * 14) i++;
      if (i === 1) {
        let rr = await db.get('SELECT marc_title FROM book WHERE rec_key=?', a.rec_key);
        console.log(rr);
        ttt = rr.marc_title;
        if (ttt.length >= 20) ttt = `${ttt.slice(0, 20)}..`;
      }
    }
  }
  res.render('index', { title, user: sess.user, i, ttt });
});

// 도서 대여_GET
router.get('/rent', function (req, res, next) {
  sess = req.session;
  title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'
  res.render('lent', { title, user: sess.user });
});

// 도서 대여 - 카메라_GET
router.get('/lentCamera', function (req, res, next) {
  sess = req.session;
  title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'
  res.render('lentCamera', { title, user: sess.user });
});

const moment = require('moment')

// 도서 반납_GET
router.get('/handIn', async (req, res, next) => {
  sess = req.session;
  if (!sess.user) { res.redirect('/user/signin'); return; }

  // results = await db.all(`SELECT * FROM rental WHERE serial_num = ? AND isReturned = ?`, [sess.user.serial_num, false]);

  // TODO	====================================
  // 현재까지 rental 정보 가져오기는 가능함
  // { rec_key, reg_key, lib_code, borrow_date, return_date, serial_num, isReturned } 정보
  // 현재는 렌탈 정보만 가져오기 -> 렌탈 정보에서의 책 정보 가져오기
  results = await db.all(`SELECT * FROM rental INNER JOIN book ON rental.rec_key = book.rec_key WHERE serial_num = ?`, [sess.user.serial_num]);
  for (var i = 0; i < results.length; i++) {
    results[i].borrow_date = moment(results[i].borrow_date).format(`’YY.MM.DD hh:mm`)
    if (results[i].return_date)
      results[i].return_date = moment(results[i].return_date).format(`’YY.MM.DD hh:mm`)
  }

  title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'
  // console.log("U ", sess.user);

  res.render('handIn', { title, user: sess.user, results: results });
});

// 도서 반납_POST
router.post('/handIn', async (req, res, next) => {
  sess = req.session;
  if (!sess.user) { res.redirect('/user/signin'); return; }

  const body = req.body;

  await db.run(`UPDATE rental SET isReturned=true, return_date=(?) WHERE rec_key=? and serial_num=?`, [new Date(), body.rec_key, sess.user.serial_num]);
  await db.run(`UPDATE book SET isBooked=0 WHERE rec_key=?`, body.rec_key)
  await client.update({
    index: 'library',
    id: body.rec_key,
    body: { doc: { isBooked: 0 } }
  })

  res.redirect('/handIn');
});

router.post('/rent', async (req, res, next) => {
  sess = req.session;
  if (!sess.user) { res.redirect('/user/signin'); return; }

  const body = req.body;
  await db.run(`INSERT INTO rental (rec_key, reg_key, lib_code, borrow_date, serial_num, isReturned) VALUES(?, ?, ?, ?, ?, ?)`,
    [body.rec_key, body.reg_key, body.lib_code, new Date(), sess.user.serial_num, false]);
  await db.run(`UPDATE book SET isBooked=1 WHERE rec_key=?`, body.rec_key)
  await client.update({
    index: 'library',
    id: body.rec_key,
    body: { doc: { isBooked: 1 } }
  })

  res.redirect('/handIn');
})

router.get('/test', (req, res, next) => {
  res.render('test')
})

module.exports = router;
