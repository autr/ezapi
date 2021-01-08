const types = require('./types.js')
const os = require('os')
const displays = require("displays")
const systeminformation = require('systeminformation')
const execSync = require('child_process').execSync
const xrandr = require('xrandr')
const linux_app_list = require('linux-app-list')

module.exports = [

	// ---------------- CAT_SYS ----------------

	{
		url: '/os',
		type: 'get',
		description: 'general os info',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			let data = {}
			const meth = [ 'arch', 'cpus', 'endianness', 'freemem', 'getPriority', 'homedir', 'hostname', 'loadavg', 'networkInterfaces', 'platform', 'release', 'tmpdir', 'totalmem', 'type', 'userInfo', 'uptime', 'version' ]
			meth.forEach( m => {
				data[ m ] = os[m]() 
			})
			res.send( data )

		}
	},

	{
		url: '/xrandr',
		type: 'get',
		description: 'monitors and resolutions',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			try {
				const data = await xrandr.parser( await execSync('DISPLAY=:0 xrandr') )
				res.send( data )
			} catch(err) {
				res.status( 500 ).send( { message: err.message } )
			}
		}

	},

	{
		url: '/apps',
		type: 'get',	
		description: 'list installed apps',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {

			if (os.type() == 'Darwin') {
				const data = await new Promise( (resolve, reject) => {
					return get_mac_apps.getApps()
				})
				res.send( data )
			} else {
				const lal = await linux_app_list()
				const list = lal.list()
				let arr = []
				for (let i = 0; i < list.length; i++ ) {
					let o = await lal.data( list[i] )
					delete o.lang
					arr.push( o )
				}
				arr ? res.send( arr ) : res.status( 500 ).send( { message: 'no apps found' } )
			}


		}
	},
]