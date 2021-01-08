const types = require('./types.js')
const fs = require('fs')
const path = require('path')
const xpm2png = require('../modules/xpm2png')
const api = require('../api.js').keys
const { execSync } = require('child_process')

module.exports = [


	// ---------------- CAT_MEDIA ----------------

	{
		url: '/xpm2png',
		type: 'get',
		description: 'retrive a png from xpm',
		category: types.CAT_MEDIA,	
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			try {
				const input = req.query.path
				const name = path.basename( input )
				const output = path.join( __dirname, './icons/' + name + '.png' )
				// if ( fs.existsSync( output ) ) return res.sendFile( output )
				const img = await xpm2png( input, true )
				const file = await img.writeAsync( output )
				res.sendFile( output )
			} catch(err) {
				throw err
				res.status(500).send( { message: err.message } )
			}
		}
	},
	{
		url: '/icon',
		type: 'get',
		description: 'application icon',
		category: types.CAT_MEDIA,	
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			try {
				const search = req.query.name
				const cmd = `find /usr/share/icons /usr/share/pixmaps -iname '*${search}*.xpm' -o -iname '*${search}*.png' -o -iname '*${search}*.svg'`
				const e = await execSync( cmd )
				const data = e.toString().split('\n').filter( e => e != '' )
				res.send( data )
			} catch(err) {
				res.status(500).send( { message: err.message } )
			}
		}
	}
]



// /usr/share/icons/

// /usr/share/pixmaps