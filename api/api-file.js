const types = require('../types.js')
const util = require('../util.js')
const os = require('os')
const fs = require('fs')
const path = require('path')
const mime = require('mime')
const shell = require('shelljs')
const find = require('node-find')
const { spawn, execSync } = require('child_process')

const UNIQUE_FILE_ID = ( obj ) => {
	return `${obj.ino}-${obj.birthtimeMs}-${obj.ctimeMs}`
}

module.exports = [

	// ---------------- CAT_FILE ----------------

	{
		url: '/ls',
		type: 'get',
		description: 'list files and folders',
		category: types.CAT_FILE,
		schema: {
			args: {
				type: 'string',
				required: true,
				desc: 'comma-separated list of ls arguments (ie. -l -R /home/user)'
			}
		},
		data: async params => {
			const args = (params.args || '').split(',')
			let url = args.find( a => a[0] != '-' ) || '.'
			let data = await shell.ls( ...args )
			for (let i = 0; i < data.length; i++ ) {
				let o = data[i]
				if ( typeof(o) == 'object' ) {
					o.url = path.resolve( url, o.name )
					o.name = path.basename( o.url )
					o.ext = path.extname( o.url )
					o.mime = mime.getType( o.ext )
					o = {...o, ...(await fs.statSync( o.url ))}
					o.unique_id = UNIQUE_FILE_ID(o)
					data[i] = o
				} 
			}
			return data
		}
	},
	{
		url: '/find',
		type: 'get',
		description: 'find files with -iname',
		category: types.CAT_FILE,
		schema: {
			paths: {
				type: 'string',
				required: true,
				desc: 'comma-separated list of directories'
			},
			iname: {
				type: 'string',
				required: true,
				desc: 'comma-separated list of search queries of name'
			}
		},
		data: async params => {
			const paths = (params.paths || '').replaceAll(',',' ').trim()
			const iname = (params.iname || '').split(',')
			let search = '-iname '
			iname.forEach( (n, i) => search += (i > 0) ? `-o -iname '${n}' ` : n )
			const cmd = `find ${ paths } ${search}`
			console.log(cmd, params)
			const e = await execSync( cmd )
			return e.toString().split('\n').filter( e => e != '' )
		}
	},
	{
		url: '/cat',
		type: 'get',
		description: 'read file to string',
		category: types.CAT_FILE,
		path: {
			type: 'string',
			required: true,
			desc: 'path to file'
		},
		data: async params => await fs.readFileSync( params.path, 'utf8' )
	},
	{
		url: '/sendfile',
		type: 'get',
		description: 'receive file',
		category: types.CAT_FILE,
		path: {
			type: 'string',
			required: true,
			desc: 'path to file'
		},
		data: async params => params.path,
		next: async (req, res, data) => res.sendFile( data )
	}

]