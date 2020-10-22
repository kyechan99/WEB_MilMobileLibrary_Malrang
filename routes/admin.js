const express = require('express');
const router = express.Router();

const sqlite3 = require('sqlite3-promisify');
const db = new sqlite3('./db/store.db');

const { getMarc } = require('./lib')

const fs = require('fs')
const axios = require('axios')
const request = require('request')

const config = require('../config.json')
const rank = require('../db/rank.json');

const { Client } = require('@elastic/elasticsearch')
const client = new Client(config.elastic)

router.use((req, res, next) => {
  sess = req.session
  title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'
  if (!sess.lib) { res.redirect('/user/signin'); return; }
  next()
})

router.get('/', async (req, res, next) => {
  const books = await db.all(`SELECT * FROM book WHERE lib_code=?`, sess.lib.code)
  //console.log(books)

  res.render('admin/index', { title, user: sess.user, lib: sess.lib, rows: books })
});

router.get('/userInfo/:serial_num', async (req, res, next) => {
  const results = await db.all(`SELECT * FROM rental INNER JOIN book ON rental.rec_key = book.rec_key WHERE serial_num = ? AND isReturned = false`, [req.params.serial_num]);

  res.status(201).json(results);
});

router.get('/scan', (req, res, next) => {
  res.render('admin/scan', { title, user: sess.user, lib: sess.lib })
});

router.get('/user', async (req, res, next) => {
  let unit = '1함대'
  if (sess.lib.id == 2) unit = '군수전대'

  let results = await db.all(`SELECT * FROM user WHERE unit LIKE '%${unit}%'`);

  //console.log(results);

  const belongData = ['', '국방부', '육군', '해군', '해병대', '공군'];

  res.render('admin/user', { title, user: sess.user, lib: sess.lib, results, rank, belongData })
});

router.get('/test', (req, res, next) => {
  sess = req.session
  sess.test = false;
  res.render('test')

  console.log(`/admin/test 호출 sess.test=${sess.test}`)
  setTimeout(() => {
    sess.test = true;
    console.log(`6초 지남 sess.test=${sess.test}`)
  }, 6000)
})

router.post('/barcode', async (req, res, next) => {
  let data = []
  for (let key in req.body.book) {
    if (req.body.book[key] === 'on') {
      let r = await db.get(`SELECT * FROM book WHERE rec_key=?`, key)
      data.push({ title: r.marc_title + (r.marc_subtitle ? ` (${r.marc_subtitle})` : ''), reg_key: r.reg_key })
    }
  }

  res.render('admin/barcode', { title, user: sess.user, lib: sess.lib, data })
})

router.post('/del', async (req, res, next) => {
  const del_book = req.body.book
  for (const b in req.body.book) {
    if (del_book[b] !== 'on') continue;

    await db.run(`DELETE FROM book WHERE rec_key=?`, b)
    await client.delete({ index: 'library', id: b })
  }

  res.redirect('/admin')
})

router.post('/modify', async (req, res, next) => {
  for (let key in req.body.book) {
    if (req.body.book[key] === 'on') {
      let data = await db.get(`SELECT * FROM book WHERE rec_key=?`, key)
      res.render('admin/modify', { title: title, user: sess.user, lib: sess.lib, marc: data })
    }
  }
})

router.post('/mod', async (req, res, next) => {
  const marc = req.body

  await db.run(`UPDATE book SET marc_title=?, marc_subtitle=?, marc_author=?, marc_publisher=?, marc_publish_year=?, marc_ea_isbn=?, kdc_class_no=?, ddc_class_no=?, marc_type=? WHERE rec_key=?`,
    [marc.marc_title, marc.marc_subtitle, marc.marc_author, marc.marc_publisher, marc.marc_publish_year, marc.marc_ea_isbn, marc.kdc_class_no, marc.ddc_class_no, marc.marc_type, marc.rec_key])

  await client.update({
    index: 'library',
    id: marc.rec_key,
    body: {
      doc: {
        marc_title: marc.marc_title,
        marc_subtitle: marc.marc_subtitle,
        marc_author: marc.marc_author,
        marc_publisher: marc.marc_publisher,
        marc_publish_year: marc.marc_publish_year,
        marc_ea_isbn: marc.marc_ea_isbn,
        kdc_class_no: marc.kdc_class_no,
        marc_type: marc.marc_type
      }
    }
  })

  res.redirect('/admin')
})

router.post('/add', async (req, res, next) => {
  sess = req.session
  if (!req.body.book) res.redirect('/admin/scan')

  sess.test = false
  res.render('admin/add')

  let s = 1;

  let r = await db.get('SELECT reg_key FROM book WHERE lib_code=? ORDER BY rec_key DESC LIMIT 1', sess.lib.code)
  if (r) s = r.reg_key.replace(sess.lib.code, '') * 1 + 1

  for (const e of req.body.book) {
    let marc_data = await getMarc(e.isbn)
    if (marc_data.err) continue;

    let jpg = ''
    if (marc_data.img.indexOf('thumbnail') !== -1) {
      //let img = marc_data.img.replace('_thumbnail', '')
      request(marc_data.img.replace('_thumbnail', '')).pipe(fs.createWriteStream(`./public/cover/${e.isbn}.jpg`)).on('close', () => { });
      jpg = `${e.isbn}.jpg`
    } else {
      const result = await axios(`https://openapi.naver.com/v1/search/book.json?query=${e.isbn}&d_isbn=${e.isbn}`, config.naver)

      if (result.data.total > 0) {
        const data = result.data.items[0]
        if (data.image) {
          let img = data.image.split('?')[0]
          request(img).pipe(fs.createWriteStream(`./public/cover/${e.isbn}.jpg`)).on('close', () => { });
          jpg = `${e.isbn}.jpg`
        }
      }

    }

    let reg_key = `${sess.lib.code}${s.toString().padStart(4, 0)}`

    await db.run(`INSERT INTO book(reg_key, marc_title, marc_subtitle, marc_author, marc_publisher, marc_publish_year, marc_ea_isbn, kdc_class_no, ddc_class_no, marc_type, marc_page, marc_size, marc_img, lib_code, lib_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reg_key, marc_data.title, marc_data.subtitle, marc_data.author, marc_data.publisher, marc_data.year, e.isbn, marc_data.kdc, marc_data.ddc, marc_data.type, marc_data.page, marc_data.size, jpg, sess.lib.code, sess.lib.name, 'A'])

    let id = await db.get(`SELECT rec_key from book WHERE reg_key=?`, reg_key);
    await client.index({
      index: 'library',
      id: id.rec_key,
      body: {
        reg_key: reg_key,
        marc_title: marc_data.title,
        marc_subtitle: marc_data.subtitle,
        marc_author: marc_data.author,
        marc_publisher: marc_data.publisher,
        marc_publish_year: marc_data.year,
        marc_ea_isbn: e.isbn,
        kdc_class_no: marc_data.kdc,
        marc_type: marc_data.type,
        marc_img: jpg,
        lib_code: sess.lib.code,
        lib_name: sess.lib.name,
        isBooked: null
      }
    })

    s++;
  }

  sess.test = true
})

module.exports = router;
