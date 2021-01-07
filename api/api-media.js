const types = require('./types.js')
const fs = require('fs')
const xpm2js = require('xpm2png')

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
				const input = './sample_1920×1280.xpm'
				const name = path.basename( input )
				const output = path.join( __dirname, './icons/' + name + '.png' )
				if ( fs.existsSync( output ) ) return res.sendFile( output )
				const img = await xpm2png( input, false )
				const file = await img.writeAsync( output )
				res.sendFile( output )
			} catch(err) {
				res.status(500).send( { message: err.message } )
			}
		}
	},
	{
		url: '/raspivid',
		type: 'get',
		description: 'open camera',
		category: types.CAT_MEDIA,
		schema: require('./camera.schema.js'),
		returns: 'json',
		method: async function(req, res) {
			try {

			} catch(err) {
				res.status(500).send( { message: err.message } )
			}
		}
	}
]