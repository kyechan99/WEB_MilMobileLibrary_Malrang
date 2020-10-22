const express = require('express');
const router = express.Router();

const sqlite3 = require('sqlite3-promisify');
const db = new sqlite3('./db/store.db');

const rank = require('../db/rank.json');

router.get('/', (req, res, next) => {
  res.send('마이페이지');
});

/*   Sign IN   */
router.get('/signin', function (req, res, next) {
  msg = ''
  //if (req.query.signup) msg = '회원가입 후 로그인 필요하단 말'
  res.render('user/signin', { msg: msg })
})

router.post('/signin', async (req, res, next) => {
  sess = req.session;

  const r = await db.get('SELECT * FROM user WHERE serial_num=? and password=?', [
    sess.login ? sess.login[0] : req.body.serial_num,
    sess.login ? sess.login[1] : req.body.password
  ]);

  delete sess.login

  if (r) {
    r.rank = rank[r.rank]
    sess.user = r;
    if (r.isAdmin) {
      lib = await db.get('SELECT * FROM library WHERE admin=?', r.serial_num)
      sess.lib = lib;
    }
    //console.log("로그인 완료")
    res.redirect('/')
  } else {
    res.render('user/signin', { msg: '가입되지 않은 군번이거나, 잘못된 비밀번호입니다.' })
  }
})

/*   Sign UP   */
router.get('/signup', function (req, res, next) {
  res.render('user/signup', { rank: rank })
})


const { sendSMS } = require('./lib')

// TODO: 군번, 등 중복체크 및 unit 값 normalization
router.post('/signup', async (req, res, next) => {
  const body = req.body
  //console.log(body)
  let phoneNo = body.phoneNo.split('-').join('')
  const r = await db.run(`INSERT INTO user (serial_num, password, rank, name, belong, unit, phoneNo) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [body.serial_num, body.password, body.rank, body.name, body.belong, body.unit, phoneNo])

  await sendSMS(phoneNo, `[국방모바일도서관] 환영합니다 ${body.name} 회원님! 국방모바일도서관 회원으로 등록되셨습니다.`)

  req.session.login = [body.serial_num, body.password]

  // POST로 넘겨서 자동 로그인
  res.redirect(307, '/user/signin')
})


router.get('/signout', (req, res, next) => {
  sess = req.session

  if (sess.user) {
    req.session.destroy(err => {
      if (err) console.error(err)
    })
  }
  res.redirect('/')
})

module.exports = router;
