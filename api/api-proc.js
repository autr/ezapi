const types = require('./types.js')
const util = require('./util.js')
const os = require('os')
const { snapshot } = (os.type() == 'Darwin') ? {} : require("process-list")
const open = require('open')
const { spawn, execSync } = require('child_process')
const { wss, inform } = require('../websockets.js')
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('./types.js')

let spawned = {}

module.exports = [



	// ---------------- CAT_PROC ----------------

	{
		url: '/snapshot',
		type: 'get',	
		description: 'active processes and pids',
		category: types.CAT_PROC,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			if (os.type() == 'Darwin') return res.send( [] )
			const data = await snapshot('pid', 'ppid', 'name', 'path', 'threads', 'owner', 'priority', 'cmdline', 'starttime', 'vmem', 'pmem', 'cpu', 'utime', 'stime' )
			res.send( data )

		}
	},

	{
		url: '/open',
		type: 'get',
		description: 'open anything with default apps',
		category: types.CAT_PROC,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			// if (!req.user) return util.NO_AUTH( req, res )
			try {
				const born = await open(req.query.url || '', { wait: false } )
				born.stdout.on( 'data', ( data ) => {
					console.log(`stdout: ${data}`);

				})

				born.stderr.on( 'data', ( data ) => {
					console.error(`stderr: ${data}`);

				})
				born.on( 'close', ( code ) => {
				  console.log(`child process CLOSED with code ${code}`);

				})
				born.on( 'exit', ( code ) => {
				  console.log(`child process EXITED with code ${code}`);

				})
				res.send( Object.keys(born) )
			} catch( err ) {
				console.log(err.message)
				res.status(500).send( { message: err.message } )
			}

		}
	},
	{
		url: '/spawn',
		type: 'get',
		description: 'spawn a process',
		category: types.CAT_PROC,
		schema: [
			{
				name: 'bin',
				desc: 'application',
				type: 'string'
			},
			{
				name: 'args',
				desc: 'arguments',
				type: 'string'
			}
		],
		returns: 'json',
		method: async function( req, res ) {
			// if (!req.user) return util.NO_AUTH( req, res )
			try {
				const cmd = req.query.bin || ''
				const args = (req.query.args || '').split(',')

				const born = await spawn( cmd, args, {})
				const { pid, spawnfile, spawnargs } = born

				spawned[pid] = born

				born.stdout.on( 'data', ( data ) => inform( pid, API_STDOUT, data.toString()))
				born.stderr.on( 'data', ( data ) => inform( pid, API_STDERR, data.toString()) )
				born.on( 'close', ( code ) => inform( pid, API_STDERR, `closed with code "${code}"`) && delete spawned[pid] )
				born.on( 'exit', ( code ) => inform( pid, API_STDERR, `exited with code "${code}"`) && delete spawned[pid] )

				res.send( { pid, spawnfile, spawnargs } )
			} catch( err ) {
				res.status(500).send( { message: err.message } )
			}

		}
	},
	{
		url: '/pkill',
		type: 'get',
		description: 'kill by app name',
		category: types.CAT_PROC,
		schema: [],
		returns: 'json',
		method: async function( req, res ) {
			try {
				if (!req.query.name) res.status(500).send( {message: 'no name supplied'} )
				const e = await execSync(`pkill -9 ${req.query.name}`)
				const data = e.toString()
				res.send( { data } )
			} catch(err) {
				res.status(500).send( { message: err.message } )
			}
		}
	},
	{
		url: '/kill',
		type: 'get',
		description: 'kill by app name',
		category: types.CAT_PROC,
		schema: [],
		returns: 'json',
		method: async function( req, res ) {
			try {
				if (!req.query.pid) res.status(500).send( {message: 'no pid supplied'} )
				const e = await execSync(`kill -9 ${req.query.pid}`)
				const data = e.toString()
				res.send( { data } )
			} catch(err) {
				res.status(500).send( { message: err.message } )
			}
		}
	}


//1716
]