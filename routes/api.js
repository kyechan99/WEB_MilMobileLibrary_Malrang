const express = require('express');
const router = express.Router();

const config = require('../config.json');

const axios = require('axios');

router.get('/book/:isbn', async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  const isbn = req.params.isbn;
  const out = { title: '', img: '' };

  const result = await axios(`https://openapi.naver.com/v1/search/book.json?query=${isbn}&d_isbn=${isbn}`, config.naver);

  if (result.data.total > 0) {
    const data = result.data.items[0];

    out.title = data.title;
    if (data.image) out.img = data.image.split('?')[0];

    return res.json(out);
  }
  /*
  let searchNL = false
  
  const result = await axios.get(`https://book.naver.com/search/search.nhn?serviceSm=advbook.basic&ic=service.summary&isbn=${isbn}`)
  .catch(err => {
      if (err) console.error(err)
  })
  
  const root = parse(result.data)
  try {
      const first = root.querySelector('#searchBiblioList li')
      const img = first.querySelector('.thumb_type img').getAttribute('src').split("?")[0]
      const title = first.querySelector('dt a').rawText

      out.title = title
      out.img = img
  } catch(err) {
      searchNL = true
  }
  
  if (!searchNL) return res.json(out)
  */
 
  /* 
      국립중앙도서관 Open API - ISBN 서지정보
      Ref: https://nl.go.kr/NL/contents/N31101030500.do
  */
  const result2 = await axios(`http://seoji.nl.go.kr/landingPage/SearchApi.do?cert_key=${config.nl.key}&result_style=json&page_no=1&page_size=10&isbn=${isbn}`)
    .catch(err => {
      if (err) console.error(err)
    })

  if (result2.data.TOTAL_COUNT < 1) {
    out.title = '#ERR'
    return res.json(out)
  }

  out.title = result2.data.docs[0].TITLE
  res.json(out)
})

router.get('/adding', (req, res) => {
  //req.session.reload(err => {})
  //sess = req.session
  //console.log(`/api/test 호출 sess.test=${sess.test}`)

  res.json({ ok: Boolean(sess.test) })
})

router.post('/test', (req, res, next) => {
  res.json(req.body)
})

module.exports = router;
