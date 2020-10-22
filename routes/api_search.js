const express = require('express');
const router = express.Router();

const config = require('../config.json');

const { Client } = require('@elastic/elasticsearch');
const client = new Client(config.elastic);

router.get('/complete', async (req, res) => {
  const { body } = await client.search({
    index: 'library',
    body: {
      "size": 0,
      "query": {
        "multi_match": {
          "query": req.query.q,
          "fields": ["marc_title.complete^1.5", "marc_subtitle.complete^1.3", "marc_publisher.complete", "marc_author.complete^1.2"]
        }
      },
      "aggs": {
        "dedup": {
          "terms": {
            "field": "marc_ea_isbn",
            "order": { "top_hit": "desc" },
            "size": 15
          },
          "aggs": {
            "dedup_docs": {
              "top_hits": {
                "size": 1,
                "highlight": {
                  "fields": {
                    "marc_title.complete": {},
                    "marc_subtitle.complete": {},
                    "marc_publisher.complete": {},
                    "marc_author.complete": {}
                  }
                }
              }
            },
            "top_hit": {
              "max": {
                "script": { "source": "_score" }
              }
            }
          }
        }
      }
    }
  }, {
    ignore: [404],
    maxRetries: 3
  });

  const aggs = body.aggregations.dedup.buckets;

  var i = 0;
  var complete = [];

  var data, b, d;
  for (var len = aggs.length, x = 0; x < len; x++) {
    data = aggs[x].dedup_docs.hits.hits[0];

    d = Object.keys(data.highlight)[0][5];
    if (d === 't') b = data._source.marc_title;
    else if (d === 's') b = data._source.marc_subtitle;
    else if (d === 'a') b = data._source.marc_author;
    else b = data._source.marc_publisher;
    
    if (!complete.includes(b)) {
      complete.push(b);
      i++;
    }

    if (i === 10) break;
  }

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.json(complete);
})

router.get('/', async (req, res) => {
  const type = req.query.type || 'default';
  const query = req.query.q || '';
  //const page = req.query.page || 1;

  let bool = {}
  if (type == 'title') {
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
  } else if (type == 'author') {
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
          "fields": ["reg_key", "marc_title^3", "marc_subtitle^2", "marc_author^2", "marc_publisher", "marc_ea_isbn.string", "lib_name^1.5"]
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
      },
      {
        "match": {
          "lib_name": { "query": "1함대", "boost": 2.5 }
        }
      },
      {
        "match": {
          "lib_name": { "query": "해군", "boost": 2 }
        }
      }]
    }
  }

  // eslint-disable-next-line
  const { body } = await client.search({
    index: 'library',
    body: {
      "size": 0,
      "query": {
        "bool": bool
      },
      "highlight": {
        "fields": {
          "marc_title": {}
        }
      },
      "aggs": {
        "dedup": {
          "terms": {
            "field": "marc_ea_isbn",
            "order": {
              "top_hit": "desc"
            },
            "size": 10
          },
          "aggs": {
            "dedup_docs": {
              "top_hits": {}
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

  const result = []
  if (body.hits.total.value > 0) {
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

      result.push({ rec_key, ...data })
    }
  }

  res.json(result);
});

module.exports = router;
