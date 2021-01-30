const express = require('express')
const app = express()
const api = require( './api.js')
const fs = require('fs')
const path = require('path')
const { inform } = require( './websockets.js' )
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('./types.js')
const { match, parse, exec } = require('matchit')
const validate = require('jsonschema').validate


// const getPermittedArray = ( listStr ) => {

//     if (!listStr) return []
//     const types = ['*']
//     let arr = []
//     const list = listStr.split(',')


//     .forEach( str => {
//         if ( types.indexOf(str) != -1 ) {
//             arr = arr.concat( 
//                 api.list
//                     .filter( item => (item.type == str || str == '*') && types.indexOf( item.type ) != -1 )
//                     .map( item => `/${item.type}${item.url}` )
//             )
//         } else {
//             arr.push( str )
//         }
//     })
//     return arr
// }

const isAllowed = async (req, res, item) => {

    let user = req.user
    let isAuth = req.isAuthenticated()


    if (!req.isAuthenticated()) {
        const users = JSON.parse( await ( await fs.readFileSync( path.resolve(__dirname, './bin/users.json') ) ).toString() )
        user = users.filter( u => u.username == 'guest' )[0]
        req.user = user
        if (user) isAuth = true
    }
    console.log(`[api] 👤  using user "${req.user.username}"`)
    if ( user && isAuth ) {

        const disallows = user.disallows || ''
        const types = ['*', 'get', 'post', 'delete', 'put' ]

        const method = req.method.toLowerCase()
        const list = user.allows[ method ].split(',').map( u => u.trim() ).map( parse )
        const found = match(req.path, list)

        if (found.length > 0) {
            const params = exec(req.path, found)
            return params
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

                const regex = await isAllowed(req, res, item)

                if (!regex) {
                    console.log(`[api] 🛑  "${req?.user?.username}" not authorised: allows="${req?.user?.allows || '~'}" disallows="${req?.user?.disallows || '~'}" -> ${item.type} ${item.url}` )
                    res.status(401).send( { error: 'not authorised' } )
                    return
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
                    const errs = result.errors.map( e => e.stack.trim() ).join(', ')
                    console.log(`[api] 🛑  invalid schema "${errs}" -> ${item.type} ${item.url}` )
                    console.log('[api] ->', args, schema )
                    res.status(422).send( { error: errs } )
                    return
                }



                // process data

                const data = (item.data) ? await item.data( { ...args, regex }, user ) : null

                // perform res and req

                const send = item.next || ( (req, res, data) => res.send( data ) )
                return send( req, res, data )
                
            } catch(err) {
                inform( process.pid, API_ERR, err.message || err )
                console.error( err )
                res.send( { error: err.message || err } )
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