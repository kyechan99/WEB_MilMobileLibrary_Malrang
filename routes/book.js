const express = require('express');
const router = express.Router();

const sqlite3 = require('sqlite3-promisify')
const db = new sqlite3('./db/store.db')

const config = require('../config.json')

const { Client } = require('@elastic/elasticsearch')
const client = new Client(config.elastic)

function isBookCode(code) {
  const len = code.length;
  let sum = 0, i;

  if (len === 13 && (code.startsWith('978') || code.startsWith('979'))) {
    for (i = 0; i < 12; i++) sum += +code[i] * (i % 2 ? 3 : 1);

    return 10 - (sum % 10) === +code[12];
  } else if (len === 10) {
    for (i = 0; i < 10; i++) sum += (code[i] == 'X' ? 10 : +code[i]) * (10 - i);

    return sum % 11 === 0;
  }

  return false;
}

router.get('/:code', async (req, res, next) => {
  let code;
  if (isBookCode(req.params.code))
    code = req.params.code;

  const rs = await db.all(`SELECT * FROM book WHERE marc_ea_isbn LIKE '%${code}%' ORDER BY rec_key DESC`);
  let a = '';
  let lib = [];
  let lib2 = {};
  rs.forEach(e => {
    if (e.lib_code.startsWith('N1')) {
      lib.push(e);
    } else {
      if (lib2[e.lib_name]) lib2[e.lib_name]++;
      else lib2[e.lib_name] = 1;
    }
  })
  let info;
  if (lib.length) info = lib[0]
  else info = rs[0]

  if (!info.marc_img || !info.marc_img.startsWith('http')) {
    info.marc_img = `/cover/${info.marc_ea_isbn}.jpg`
  }
  res.render('book', { info, lib, lib2 });
});

module.exports = router;
