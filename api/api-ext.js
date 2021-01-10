// (document.querySelector('#ls-c-search__input-label').value = 'bristol') && document.querySelector('.ls-c-search__submit').click()

// document.querySelector('.ls-c-locations-list-list')
const types = require('../types.js')
const puppeteer = require('puppeteer-core')


const bbc = {
    search_input: '#ls-c-search__input-label',
    search_btn: '.ls-c-search__submit',
    search_list: '#location-list li',
    search_more_btn: '#location-list + button',
    overview_list: '.wr-day a',
    overview_icons: '#orb-modules svg',
    overview_item_place: '#wr-location-name-id',
    overview_item_date: '.wr-date',
    overview_item_icon: '.wr-weather-type svg',
    slot_list: '.wr-time-slot',
    slot_item_time: '.wr-time-slot-primary__title',
    slot_item_icon: '.wr-weather-type icon',
    slot_item_temp: '.wr-value--temperature--c',
    slot_item_precip: '.wr-time-slot-primary__precipitation',
    slot_item_wind: '.wr-value--windspeed',
    slot_item_dir: '.wind-rose__direction-abbr'
}

const block = (req) => {
    const blocked = ['stylesheet', 'font', 'image']
    if(blocked.indexOf( req.resourceType() ) != -1) return req.abort()
    req.continue()
}



module.exports = [

    // ----------- CAT_EXT -----------

    {
        url: '/weather_locations',
        type: 'post',
        schema: {
            place: {
                type: 'string',
                required: true,
                desc: 'name of place, city, town etc'
            }
        },
        data: async params => {

            const browser = await puppeteer.launch({executablePath: 'chromium'})
            const page = await browser.newPage()
            await page.setRequestInterception(true)
            page.on('request', block)
            await page.goto('https://www.bbc.com/weather')
            const args = {params, bbc}
            const data = await page.evaluate( async args => {

                return new Promise( (resolve, reject) => {

                    let data = []
                    const select = e => document.querySelector(e)
                    const selectAll = e => document.querySelectorAll(e)

                    document.querySelector(args.bbc.search_input).value = args.params.place
                    document.querySelector(args.bbc.search_btn).click()

                    let pressed = false
                    let finished = false

                    function timeout() {
                        const items = Array.from( document.querySelectorAll(args.bbc.search_list) )
                        const neu = items.map( li => {
                            return {
                                name: li.innerText,
                                id: li.querySelector('a').getAttribute('data-id')
                            }
                        })

                        if (!pressed) setTimeout(timeout, 100)

                        if (pressed) resolve(data)

                        if (neu.length > data.length) {
                            data = neu
                            const btn = document.querySelector(args.bbc.search_more_btn)
                            if (btn) btn.click()
                            pressed = true
                        }

                    }

                    timeout()

                    setTimeout( () => {
                        reject( 'timed out' )
                    }, 5000)
                })

            }, args)

            return data


        },
        description: 'show list of API endpoints',
        category: types.CAT_EXT
    },

    {
        url: '/weather_report',
        type: 'post',
        schema: {
            id: {
                type: 'string',
                required: true,
                desc: 'id of location'
            }
        },
        data: async params => {

            const browser = await puppeteer.launch({executablePath: 'chromium'})
            const page = await browser.newPage()
            // await page.setRequestInterception(true)
            // page.on('request', block)
            page.on('pageerror', (err) => console.error(err.toString()))
            page.on('error', (err) => console.error(err.toString()))
            await page.goto(`https://www.bbc.com/weather/${params.id}`)
            const data = await page.evaluate( async bbc => {

                const weather = bbc => new Promise( (resolve, reject) => {
                    try {
                        let days = []
                        let icons = Array.from( document.querySelectorAll( bbc.overview_icons ) ).map( s => s.outerHTML )
                        const place = document.querySelector(bbc.overview_item_place)?.innerText

                        const all = document.querySelectorAll( bbc.overview_list )
                        let idx = 0

                        const scrape = () => {
                            const item = all[idx]
                            if (!item) return resolve(days)
                            item.click()

                            let o = {
                                date: item.querySelector(bbc.overview_item_date)?.childNodes[0]?.innerText,
                                icon: item.querySelector(bbc.overview_item_icon)?.outerHTML,
                                slots: []
                            }

                            document.querySelectorAll(bbc.slot_list).forEach( s => {
                                if (s) {
                                    o.slots.push( {
                                        time: s.querySelector( bbc.slot_item_time )?.innerText,
                                        icon: s.querySelector( bbc.slot_item_icon )?.outerHTML,
                                        temperature: s.querySelector( bbc.slot_item_temp )?.innerText,
                                        precipitation: s.querySelector( bbc.slot_item_precip )?.innerText,
                                        wind_speed: s.querySelector( bbc.slot_item_wind )?.innerText,
                                        wind_direction: s.querySelector( bbc.slot_item_dir )?.innerText

                                    })
                                }
                            })

                            days.push( o )

                            if (idx++ < all.length) setTimeout( scrape, 100 )
                            if (idx >= all.length) {
                                resolve( { days, icons, place } )
                            }
                        }

                        scrape()

                        setTimeout( () => {
                            reject( 'timed out' )
                        }, 5000)
                    } catch(err) {
                        reject( 'error occurred' )
                    }


                })

                return weather(bbc)

            }, bbc)

            console.log(data)
            return data


        },
        description: 'show list of API endpoints',
        category: types.CAT_EXT
    }
]
