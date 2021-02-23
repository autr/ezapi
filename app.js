const express = require('express')
const app = express()
const api = require( './api.js')
const fs = require('fs')
const path = require('path')
const { inform } = require( './websockets.js' )
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('./types.js')
const { match, parse, exec } = require('matchit')
const validate = require('jsonschema').validate


const isAllowed = async (req, res, item) => {
    
    let user = req.user
    let isAuth = req.isAuthenticated()

    if (!req.isAuthenticated()) {
        const users = JSON.parse( await ( await fs.readFileSync( path.resolve(__dirname, './bin/users.json') ) ).toString() )
        user = users.filter( u => u.username == 'guest' )[0]
        req.user = user
        if (user) isAuth = true
    }
    const c = '\x1b[93m'
    const e = '\033[0m'
    console.log(`${c}[api] 👤  ${req.method} ${req.path} -> ${req.user.username} ${e}`)
    if ( user && isAuth ) {

        const method = req.method.toLowerCase()

        const whitelist = !user.allows[ method ] ? [] : user.allows[ method ].split(',').map( u => u.trim() ).map( parse )
        const apilist = api.list.filter( a => a.type.toLowerCase() == method ).map( a => a.url ).map(parse)

        const foundA = match(req.path, whitelist)
        const foundB = match(req.path, apilist)
        if (foundA.length > 0 && foundB.length > 0) {

            // now we must match against the real endpoints (not shorthand)...
            
            const params = exec(req.path, foundB)
            return params
        }
    }
    return false 
}

function sendError( res, code, message, extra ) {
    res.status( code ).send( { message, code, status: code, error: true, ...extra } )
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

                const regex = await isAllowed(req, res, item)

                if (!regex) {
                    console.log(`[api] 🛑  "${req?.user?.username}" not authorised: allows="${req?.user?.allows || '~'}" -> ${item.type} ${item.url}` )
                    return sendError( res, 401, 'not authorised')
                }

                const user = {}
                const args = ( item.type.toLowerCase() == 'get' ) ? req.query : req.body

                // check schema

                const schema = {
                    type: 'object',
                    properties: item.schema
                }

                const result = validate( args, schema, {required: true} )

                if (!result.valid) {
                    const errs = result.errors.map( e => e.stack.trim() ).join(', ').replaceAll('instance.', '')
                    console.log(`[api] 🛑  ${req.method} ${req.path} invalid schema "${errs}" -> ${item.type} ${item.url}`, args )
                    console.log( '--------------\n', args, '--------------\n')
                    console.log( '--------------\n', schema, '--------------\n')
                    return sendError( res, 422, errs, { args } )
                }

                // process data

                const data = (item.data) ? await item.data( { ...args, regex }, user ) : {}

                // perform res and req

                const colors = {
                    get: '\x1b[92m',
                    post: '\x1b[96m',
                    delete: '\x1b[95m'
                }
                const c = colors[req.method.toLowerCase()]
                const e = '\033[0m'
                console.log(`${c}[api] ✅  ${req.method} ${req.path} -> success! ${e}`)
                const send = item.next || ( (req, res, data) => res.send( data ) )
                return send( req, res, data )
                
            } catch(err) {

                console.log(`[api] 🚨  ${req.method} ${req.path} caught error `, err.message || err, err.stack || err )
                inform( req.path, API_ERR, err.message || err )
                return sendError( res, err.code || 500, err.message || err )
                
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