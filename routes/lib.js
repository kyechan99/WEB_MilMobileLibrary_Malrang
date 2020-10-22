const axios = require('axios');
const cheerio = require('cheerio');
//const parser = require('node-html-parser');
//const qs = require('querystring').parse;
const iconv = require('iconv-lite');
const { unserialize } = require('php-serialize');

const config = require('../config.json')

const trim = s => s.trim().replace(/ +/g, ' ');

async function getMarc(isbn) {
    let rawid = ''
    const out = {err: false, title: '', subtitle: '', img: '', type: '', author: '', publisher: '', year: '', kdc: '', ddc: '', page: '', size: ''}
    //const $ = cheerio.load(html)
    
    await axios.get(`https://nl.go.kr/NL/contents/search.do?detailSearch=true&isbnOp=isbn&isbnCode=${isbn}`)
    .then(rs => {
        const $ = cheerio.load(rs.data)
        try {
            const first = $('.row').first()
            const second = first.find('.txt_left a').attr('href')
            rawid = second.split('#')[1]
        } catch(err) {
            out.err = true
        }
    }).catch(err => {
        if (err) out.err = true
    })
    
    if (out.err) return out;
    
    await axios.post('https://nl.go.kr/NL/search/nl_detail_view.ajax', rawid)
    .then(rs => {
        //console.log(rs.data)
        const $ = cheerio.load(rs.data)
        
        out.img = $('.img_wrap img').attr('src')
        
        let type = $('.detail_tit span').text()
        out.type = type.substring(1, type.length-1)
        
        $('.detail_tit span').text('')
        let title = trim($('.detail_tit').text())
        out.title = title

        if (title.indexOf(' : ') !== -1) {
            let split = title.split(' : ')
            out.subtitle = trim(split.slice(1).join(' : '))
            out.title = trim(split[0])
        }
        
        $('.more_info_wrap p').each((i, e) => {
            const v = $(e).find('span').text()
            $(e).find('span').remove()
            
            if (v.indexOf('저자') != -1) {
                let author = $(e).text().trim().split('\n')[0].split('/')
                out.author = trim(author[author.length-1].replace(' ;', '; '))
            } else if (v.indexOf('발행') != -1) {
                out.publisher = trim($(e).find('a').text().replace(':', '').replace(',', ''))
                let year = $(e).text().split(',')
                out.year = trim(year[year.length-1])
            } else if (v.indexOf('분류') != -1) {
                $(e).find('a').each((ii, ee) => {
                    const ve = $(ee).text()
                    if (ve.indexOf('한국') != -1) {
                        out.kdc = trim(ve.split('->')[1])
                    } else if (ve.indexOf('듀이') != -1) {
                        out.ddc = trim(ve.split('->')[1])
                    }
                })
            } else if (v.indexOf('형태') != -1) {
                for (const x of $(e).text().split(':')) {
                    if (x.indexOf('p.') != -1) {
                        out.page = trim(x)
                    } else if(x.indexOf('cm') != -1) {
                        let size = x.split(';')
                        out.size = trim(size[size.length-1])
                    }
                }
            }
        })
    })
    
    return out
}

async function sendSMS(phone, message) {
    let r = await axios({
        method: 'post',
        url: 'http://sms.phps.kr/lib/send.sms',
        data: `adminuser=${config.sms.id}&authkey=${config.sms.auth}&phone=${phone}&name=&name2=&rphone=${config.sms.phone}&msg=&sms=${escape(iconv.encode(message, 'euc-kr').toString('binary'))}&date=0&ip=34.64.134.249`,
        headers: {
            'Accept': '',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'PHP Script'
        },
        responseType: 'arraybuffer',
        responseEncoding: 'binary'
    })
    //console.log(unserialize(r.data.toString()))
    return unserialize(r.data.toString()).status === 'success'
}

if (require.main === module) {
    (async () => {
        console.time('ap')
        const r = await getMarc('9788956393278')
        console.log(r)
        console.timeEnd('ap')
    })();
}

module.exports = { trim, getMarc, sendSMS }
