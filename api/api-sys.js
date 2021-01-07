const types = require('./types.js')
const os = require('os')
const displays = require("displays")
const systeminformation = require('systeminformation')
const execSync = require('child_process').execSync
const xrandr = require('xrandr')

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

	}
]