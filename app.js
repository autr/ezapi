const express = require('express')
const app = express()
const api = require( './api.js')
const fs = require('fs')
const path = require('path')
const { inform } = require( './websockets.js' )
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('./types.js')


const isAllowed = async (req, res, item) => {

    let user = req.user
    let isAuth = req.isAuthenticated()

    if (!req.isAuthenticated()) {
        const users = JSON.parse( await ( await fs.readFileSync( path.resolve(__dirname, './bin/users.json') ) ).toString() )
        user = users.filter( u => u.username == 'guest' )[0]
        req.user = user
        if (user) isAuth = true
    }
    if ( user && isAuth ) {

        const allows = user.allows || ''
        const disallows = user.disallows || ''
        let a = allows.split(',')
        if (allows == '*') a = Object.keys(api.keys)
        if (allows == 'get') a = api.list.filter( i => i.type == 'get' ).map( i => i.url )
        if (allows == 'post') a = api.list.filter( i => i.type == 'post' ).map( i => i.url )

        let d = disallows.split(',')
        if (disallows == '*') d = Object.keys(api.keys)
        if (disallows == 'get') d = api.list.filter( i => i.type == 'get' ).map( i => i.url )
        if (disallows == 'post') d = api.list.filter( i => i.type == 'post' ).map( i => i.url )

        a = a.filter( a => d.indexOf(a) == -1 && a != '' )

        if ( a.indexOf( req.path ) != -1 ) {
            // check arguments
            return true
        }
    }
    return false 
}


api.list.forEach( item => {

    const emoji = item.type == 'use' ? '🔧' : item.type == 'get' ? '🍬' : '✉️'
    console.log(`[api] ${emoji}  ${item.type.toUpperCase()}: ${item.url || '~'} ${ item.type == 'use' ? item.description : ''}`)
	if (item.type == 'use') {
		app[ item.type ]( item.next )
	} else {
        app[ item.type ]( item.url, async (req, res) => {
            try {

                // authorise endpoint

                const auth = await isAllowed(req, res, item)

                if (!auth) {
                    res.status(401).send( { error: 'not authorised' } )
                    console.log(`[api] 🛑  not authorised: "${req.user || '~'}"` )
                    return
                }

                const user = {}

                // process data

                const data = (item.data) ? await item.data( req.query, user ) : null

                // perform res and req

                const send = item.next || ( (req, res, data) => res.send( data ) )
                return send( req, res, data )
                
            } catch(err) {
                inform( process.pid, API_ERR, err.message )
                res.send( { error: err.message } )
            }
        })
	}
})


const server = app.listen(3000, async () => {
    const dest = path.resolve(__dirname, './bin/users.json')
    const src = path.resolve(__dirname, './api/users.template.json')
    try {
        const exists = await fs.existsSync( dest )
        if (!exists) {
            const copy = await fs.copyFileSync( src, dest )
            console.log(`[api] ✅  success copying ${src} -> ${dest}` )
        }
    } catch(err) {
        console.log(`[api] ❌  error copying ${src} -> ${dest}: "${err.message}"` )
    }
	const port = server.address().port
	console.log(`[api] ✨  server running on port: ${port}`)
})