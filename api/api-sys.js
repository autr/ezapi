const types = require('../types.js')
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
		data: async params => {
			let data = {}
			const meth = [ 'arch', 'cpus', 'endianness', 'freemem', 'getPriority', 'homedir', 'hostname', 'loadavg', 'networkInterfaces', 'platform', 'release', 'tmpdir', 'totalmem', 'type', 'userInfo', 'uptime', 'version' ]
			meth.forEach( m => data[ m ] = os[m]() )
			return data
		}
	},

	{
		url: '/xrandr',
		type: 'get',
		description: 'monitors and resolutions',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		data: async params => {
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
		data: async params => {

			if (os.type() == 'Darwin') {
				return get_mac_apps.getApps()
			} else {
				const lal = await linux_app_list()
				const list = lal.list()
				let data = []
				for (let i = 0; i < list.length; i++ ) {
					let o = await lal.data( list[i] )
					delete o.lang
					data.push( o )
				}
				return data
			}


		}
	},
]