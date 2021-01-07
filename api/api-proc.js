const types = require('./types.js')
const util = require('./util.js')
const os = require('os')
const { snapshot } = (os.type() == 'Darwin') ? {} : require("process-list")
const linux_app_list = require('linux-app-list')
const open = require('open')
const { spawn } = require('child_process')

module.exports = [


	// ---------------- CAT_PROC ----------------

	{
		url: '/apps_list',
		type: 'get',	
		description: 'list installed apps',
		category: types.CAT_PROC,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {

			if (os.type() == 'Darwin') {
				const data = await new Promise( (resolve, reject) => {
					return get_mac_apps.getApps()
				})
				res.send( data )
			} else {
				const data = await linux_app_list()
				data ? res.send( data ) : res.status( 500 ).send( { message: 'no apps found' } )
			}


		}
	},

	{
		url: '/activity',
		type: 'get',	
		description: 'show processes',
		category: types.CAT_PROC,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			// pid: Number - process pid
			// ppid: Number - parent process pid
			// name: String - process name (title)
			// path: String - full path to the process binary file
			// threads: Number - threads per process
			// owner: String - the owner of the process
			// priority: Number - an os-specific process priority
			// cmdline: String - full command line of the process
			// starttime: Date - the process start date / time
			// vmem: String - virtual memory size in bytes used by process
			// pmem: String - physical memory size in bytes used by process
			// cpu: Number - cpu usage by process in percent
			// utime: String - amount of time in ms that this process has been scheduled in user mode
			// stime: String - amount of time that in ms this process has been scheduled in kernel mode
			if (os.type() == 'Darwin') return res.send( [] )
			const data = await snapshot('pid', 'name', 'threads' )
			res.send( data )

		}
	},

	{
		url: '/open',
		type: 'get',
		description: 'open anything',
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
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			// if (!req.user) return util.NO_AUTH( req, res )
			try {
				const cmd = req.query.url || ''
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
				console.log(err.message)
				res.status(500).send( { message: err.message } )
			}

		}
	}

]