const types = require('./types.js')
const util = require('./util.js')
const os = require('os')
const fs = require('fs')
const path = require('path')
const mime = require('mime')
const shell = require('shelljs')

const UNIQUE_FILE_ID = ( obj ) => {
	if (!obj.ino || !obj.birthtimeMs || !obj.ctimeMs) throw { message: "no properly formatted obj for UNIQUE_FILE_ID" }
	return `${obj.ino}-${obj.birthtimeMs}-${obj.ctimeMs}`
}

module.exports = [

	// ---------------- CAT_FILE ----------------

	{
		url: '/ls',
		type: 'get',
		description: 'list files and folders',
		category: types.CAT_FILE,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			const url = require('expand-tilde')( req.query.url || os.homedir() )
			let data = await shell.ls( '-l', url )
			for (let i = 0; i < data.length; i++ ) {
				try {
					const f = data[i]
					f.url = path.resolve( url, f.name )
					f.name = path.basename( f.url )
					f.ext = path.extname( f.url )
					f.mime = mime.getType( f.ext )
					f.file = (await fs.statSync( f.url )).isFile()
					f.id = UNIQUE_FILE_ID(f)
				} catch(err) {
					console.log('', err.message)
				}
			}
			res.send( data )
		}
	},
	{
		url: '/find',
		type: 'get',
		description: 'list files and folders',
		category: types.CAT_FILE,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			const url = require('expand-tilde')( req.query.url || os.homedir() )
			const query = req.query.query
			let data = (await shell.find( url )).filter(function (file) {
			  return file.match(/\.mp4?$/i);
			})
			for (let i = 0; i < data.length; i++ ) {
				try {
					let f = await fs.statSync( data[i] )
					f.url = data[i]
					f.name = path.basename( f.url )
					f.ext = path.extname( f.url )
					f.mime = mime.getType( f.ext )
					f.file = f.isFile()
					f.id = UNIQUE_FILE_ID(f)
					data[i] = f
				} catch(err) {
					console.log('', err.message)
				}
			}
			res.send( data )
		}
	},
	{
		url: '/cat',
		type: 'get',
		description: 'view files or folders',
		category: types.CAT_FILE,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			if (!req.user) return util.NO_AUTH( req, res )
			const data = await shell.ls( req.query.url )
			const ls = module.exports.find( e => e.type == 'get' && e.url == '/ls')
			try {
				await ls.method( req, {
					send: data  => {
						const d = data[0]
						if (!d) {
							res.status( 500 ).send( { message: `${ req.query.url} does not exist`})
						} else if ( !d.file ) {
							res.status( 500 ).send( { message: `${ req.query.url} is a directory`})
						} else {
							res.sendFile( data[0].url )
						}
						
					}
				})
			} catch( err ) {
				res.status(404).send({ message: `Could not find ${ req.query.url }` })
			}
		}
	}

]