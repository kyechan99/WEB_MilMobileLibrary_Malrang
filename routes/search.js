const express = require('express');
const router = express.Router();

const sqlite3 = require('sqlite3-promisify')
const db = new sqlite3('./db/store.db')

const config = require('../config.json')

const { Client } = require('@elastic/elasticsearch')
const client = new Client(config.elastic)

router.get('/', async (req, res, next) => {
  sess = req.session;
  title = sess.user ? `${sess.user.rank} ${sess.user.name}` : '국방모바일도서관'

  const type = req.query.type || 'default';
  const query = req.query.query || '';
  //const page = req.query.page || 1;

  if (query === '') {
    res.render('search', { title, user: sess.user, type, query, results: [], test: [] });
    return;
  }

  let bool = {}
  if (type === 'title') {
    bool = {
      "must": [{
        "multi_match": {
          "query": query,
          "fields": ["marc_title^3", "marc_subtitle^2"]
        }
      }],
      "should": [{
        "match": {
          "marc_author": { "query": "베르베르", "boost": 2 }
        }
      }]
    }
  } else if (type === 'author') {
    bool = {
      "must": [{
        "match": {
          "marc_author": query
        }
      }],
      "should": [{
        "match": {
          "marc_author": { "query": "베르베르", "boost": 2 }
        }
      }]
    }
  } else {
    bool = {
      "must": [{
        "multi_match": {
          "query": query,
          "fields": ["reg_key", "marc_title^3", "marc_subtitle^2", "marc_author^2", "marc_publisher", "marc_ea_isbn", "lib_name^1.5"]
        }
      }],
      "should": [{
        "match": {
          "marc_author": { "query": "베르베르", "boost": 2 }
        }
      }, {
        "match": {
          "marc_author": { "query": "채사장", "boost": 1.2 }
        }
      }, {
        "match": {
          "lib_name": { "query": "1함대", "boost": 2.5 }
        }
      }, {
        "match": {
          "lib_name": { "query": "해군", "boost": 2 }
        }
      }]
    }
  }

  const { body } = await client.search({
    index: 'library',
    body: {
      "size": 0,
      "query": {
        "bool": bool
      },
      /*
      "highlight": {
        "fields": {
          "marc_title": {}
        }
      },
      */
      "aggs": {
        "dedup": {
          "terms": {
            "field": "marc_ea_isbn",
            "order": {
              "top_hit": "desc"
            },
            "size": 300
          },
          "aggs": {
            "dedup_docs": {
              "top_hits": {"size": 100}
            },
            "top_hit": {
              "max": {
                "script": {
                  "source": "_score"
                }
              }
            }
          }
        }
      }
    }
  }, {
    ignore: [404],
    maxRetries: 3
  })

  //console.log(body)
  const result = []
  if (body.hits.total.value > 0) {
    const rental = await db.all('SELECT rec_key, serial_num FROM rental WHERE isReturned = 0')

    for (const e of body.aggregations.dedup.buckets) {
      l = ''
      if (e.doc_count > 1) {
        su = {}
        for (let r of e.dedup_docs.hits.hits) {
          su[r._source.lib_name] = (su[r._source.lib_name] || 0) + 1
        }

        for (let k in su) {
          l += `${k} ${su[k]}권 | `
        }
        l = l.slice(0, -2).trim()
      }

      let data = e.dedup_docs.hits.hits[0]._source
      let rec_key = e.dedup_docs.hits.hits[0]._id
      let k = 0

      for (let sour of e.dedup_docs.hits.hits) {
        if (sour._source.lib_code.startsWith('N1') && !sour._source.isBooked) {
          data = sour._source
          rec_key = sour._id
          k++;
        }
      }

      data.k = k;

      data.lib_name = l || data.lib_name
      if (!data.marc_img || !data.marc_img.startsWith('http')) {
        data.marc_img = `/cover/${data.marc_ea_isbn}.jpg`
      }

      if (data.marc_ea_isbn.length > 27)
        data.marc_ea_isbn = `${data.marc_ea_isbn.slice(0, 27)}..`;

      let rent_check = rental.find(e => e.rec_key == rec_key);
      if (rent_check) {
        if (!sess.user || rent_check.serial_num != sess.user.serial_num)
            data.isBooked = 10;
      }

      result.push({ rec_key: rec_key, ...data })
    }
  }

  res.render('search', { title, user: sess.user, type, query, results: result.slice(0, 10), test: result });
});

module.exports = router;
