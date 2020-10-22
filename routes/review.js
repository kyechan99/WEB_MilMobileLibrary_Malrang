var express = require('express');
var router = express.Router();

const sqlite3 = require('sqlite3-promisify');
const db = new sqlite3('./db/store.db');

const config = require('../config.json');
const rank = require('../db/rank.json');

router.use((req, res, next) => {
    sess = req.session
    title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'
    next()
})

router.get('/', async (req, res, next) => {
	const results = await db.all(`SELECT review.*, user.rank, user.name FROM review INNER JOIN user ON user.serial_num = review.serial_num`);
	
    res.render('review/index', { title: title, user: sess.user, rank, results });
});

router.get('/write', (req, res, next) => {
	if (!sess.user)
		res.redirect('/user/signin');
	else
		res.render('review/write', { title: title, user: sess.user });
});

router.get('/content/:idx', async (req, res, next) => {
	// result = { 
	// 	bookTitle:'개미1', 
	// 	reviewTitle:'개미1을 읽고 남기는 리뷰입니다.', 
	// 	author:'이병 홍길동', 
	// 	serial_num:'19-71001293', 
	// 	content:'개미1을 읽고 \n 너무 재미없어서 \n 어쩌구 저쩌구\n 으악'
	// };
	
	// 	아래 처럼 쓰면 됨
	// result = await db.get(`SELECT * FROM review WHERE idx=?`, req.params.idx)
	const result = await db.get(`SELECT review.*, user.rank, user.name FROM review INNER JOIN user ON user.serial_num = review.serial_num WHERE idx=?`, req.params.idx);
	
    res.render('review/content', { title: title, user: sess.user, rank, result });
});


router.post('/', async (req, res, next) => {
	const bookTitle = req.body.bookTitle;
	const reviewTitle = req.body.reviewTitle;
	const content = req.body.content;
	// author : sess.serial_num;
	// createdAt : new Date()
	
	const r = await db.run(`INSERT INTO review (bookTitle, reviewTitle, serial_num, content, createdAt) VALUES(?, ?, ?, ?, ?)`, [bookTitle, reviewTitle, sess.user.serial_num, content, new Date()])
	
	res.redirect('/review');
})

router.post('/del/:idx', async (req, res, next) => {
	// 삭제 도용 방지해서 일단 sess.user 이용하는데 관리자도 삭제 가능하게 하려면 차후에 수정해야됨
	sess = req.session
	
	const bookTitle = req.body.bookTitle;
	const reviewTitle = req.body.reviewTitle;
	const content = req.body.content;
	
	await db.run(`DELETE FROM review WHERE idx=? AND serial_num=?`, [req.params.idx, sess.user.serial_num]);
	
	res.redirect('/review');
})

module.exports = router;
