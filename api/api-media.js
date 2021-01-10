const types = require('../types.js')
const fs = require('fs')
const path = require('path')
const xpm2png = require('../modules/xpm2png')
const api = require('../api.js').keys
const { execSync } = require('child_process')

module.exports = [

	// ---------------- CAT_MEDIA ----------------

	{
		url: '/xpm2png',
		type: 'post',
		description: 'retrieve a png from xpm',
		category: types.CAT_MEDIA,	
		schema: {
			path: {
				type: 'string',
				description: 'path to xpm file',
				required: true
			}
		},
		data: async params => {
			const input = params.path
			const name = path.basename( input )
			const output = path.join( __dirname, '../bin/icons/' + name + '.png' )
			if (await fs.existsSync(output)) return output
			const img = await xpm2png( input, true )
			const file = await img.writeAsync( output )
			return output
		},
		next: async (req, res, data) => res.sendFile( data )
	},
	{
		url: '/icons',
		type: 'get',
		description: 'find application icons',
		category: types.CAT_MEDIA,	
		schema: {
			iname: {
				type: 'string',
				description: 'iname of app',
				required: true
			}
		},
		data: async params => {
			const s = params.iname
			const cmd = `find /usr/share/icons /usr/share/pixmaps -iname '*${s}*.xpm' -o -iname '*${s}*.png' -o -iname '*${s}*.svg'`
			const data = await execSync( cmd )
			return data.toString().split('\n').filter( e => e != '' )
		}
	}
]