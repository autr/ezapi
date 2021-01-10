const types = require('../types.js')
const util = require('../util.js')
const os = require('os')
const { snapshot } = (os.type() == 'Darwin') ? {} : require("process-list")
const open = require('open')
const { spawn, execSync } = require('child_process')
const { wss, inform } = require('../websockets.js')
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('../types.js')

let spawned = {}

module.exports = [



	// ---------------- CAT_PROC ----------------

	{
		url: '/snapshot',
		type: 'get',	
		description: 'all active processes and pids',
		category: types.CAT_PROC,
		schema: {},
		data: async params => await snapshot(
			'pid', 
			'ppid', 
			'name', 
			'path', 
			'threads', 
			'owner', 
			'priority', 
			'cmdline', 
			'starttime', 
			'vmem', 
			'pmem', 
			'cpu', 
			'utime', 
			'stime')
	},

	{
		url: '/open',
		type: 'post',
		description: 'open anything with default apps',
		category: types.CAT_PROC,
		schema: {
			path: {
				type: 'string',
				required: true,
				desc: 'path to file'
			}
		},
		data: async params => {
			const born = await open(params.path || '', { wait: false } )
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
			return Object.keys(born)

		}
	},
	{
		url: '/spawn',
		type: 'post',
		description: 'spawn a process',
		category: types.CAT_PROC,
		schema: {
			bin: {
				type: 'string',
				required: true,
				desc: 'name of binary'
			},
			args: {
				type: 'array',
				required: false,
				desc: 'list of arguments'
			}
		},
		data: async params => {
			const cmd = params.bin || ''
			const args = (params.args || '').split(',')

			const born = await spawn( cmd, args, {})
			const { pid, spawnfile, spawnargs } = born

			spawned[pid] = born

			born.stdout.on( 'data', ( data ) => inform( pid, API_STDOUT, data.toString()))
			born.stderr.on( 'data', ( data ) => inform( pid, API_STDERR, data.toString()) )
			born.on( 'close', ( code ) => inform( pid, API_STDERR, `closed with code "${code}"`) && delete spawned[pid] )
			born.on( 'exit', ( code ) => inform( pid, API_STDERR, `exited with code "${code}"`) && delete spawned[pid] )

			return { pid, spawnfile, spawnargs }
		}
	},
	{
		url: '/pkill',
		type: 'post',
		description: 'kill by app name',
		category: types.CAT_PROC,
		schema: {
			name: {
				type: 'string',
				required: true,
				desc: 'name of process'
			}
		},
		data: async params => {
			const e = await execSync(`pkill -9 ${params.name}`)
			return e.toString()
		}
	},
	{
		url: '/kill',
		type: 'post',
		description: 'kill by pid',
		category: types.CAT_PROC,
		schema: {
			pid: {
				type: 'number',
				required: true,
				desc: 'pid of process'
			}
		},
		data: async params => {
			if (!params.pid) res.status(500).send( {message: 'no pid supplied'} )
			const e = await execSync(`kill -9 ${params.pid}`)
			return e.toString()
		}
	}
]