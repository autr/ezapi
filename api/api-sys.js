const types = require('../types.js')
const os = require('os')
const displays = require("displays")
const systeminformation = require('systeminformation')
const execSync = require('child_process').execSync
const xrandr = require('xrandr')
const linux_app_list = require('linux-app-list')
const ini = require('../modules/ini')
const fs = require('fs')
const path = require('path')
const config_schema = require('./config.schema.js')
const videocore = require('../modules/videocore')

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
		url: '/uptime',
		type: 'get',
		description: 'show uptime info',
		category: types.CAT_SYS,
		schema: {},
		data: async params => {

			return JSON.parse( await (await execSync( 'uptime | jc --uptime')).toString() )
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
	{
		url: '/dtoverlay',
		type: 'get',	
		description: 'list of all possible overlays',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		data: async params => {

			return (await (await execSync('dtoverlay -a')).toString()).split('\n').filter( (d,i) => i > 0 && d != '' ).map( d => d.trim() )


		}
	},
	{
		url: '/options',
		type: 'get',	
		description: 'list all possible config options',
		category: types.CAT_SYS,
		schema: {
			refresh: {
				type: 'boolean',
				required: false,
				desc: 'refreshes list of options (takes longer)'
			}
		},
		returns: 'json',
		data: async params =>  {

			const output = path.join( __dirname, '../bin/config.options.json' )
			const exists = await fs.existsSync(output)
			if (params.refresh || !exists ) {
				const txt = await (await execSync(`strings /boot/start.elf |grep -Ei '^[a-z0-9_]{6,32}$' |sort -u |xargs -i vcgencmd get_config {} |grep =`)).toString()
				const data = txt.split('\n').reduce(function(o, l, i) {
					const pair = l.split('=')
					if (pair[0] != '' && pair[0]) o[pair[0]] = pair[1]
					return o
				}, {})
				await fs.writeFileSync( output, JSON.stringify(data, null, 2) )
				return data
			} else {
				return await (await fs.readFileSync( output )).toString()
			}
		},
		next: async (req, res, data) => {
			res.json( JSON.parse(data) )
		}
	},
	{
		url: '/config',
		type: 'get',	
		description: 'view /boot/config.txt',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		data: async params =>  ini.decode( (await fs.readFileSync('/boot/config.txt', 'utf8') ) )
	},
	{
		url: '/config',
		type: 'post',	
		description: 'write /boot/config.txt',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		data: async params => {

			const o = {
				"dtparam": "audio=on",
				"dtoverlay": "adv7282m,imx477",
				"hdmi_force_hotplug": "1",
				"pi4": {
					"dtoverlay": "vc4-fkms-v3d",
					"max_framebuffers": "2",
					"enable_tvout": "0"
				},
					"all": {
					"start_x": "1",
					"gpu_mem": "128",
					"enable_tvout": "1"
				}
			}

			return ini.encode( o )

		}
	},
	{
		url: '/vcgencmd',
		type: 'get',	
		description: 'view all possible vcgencmd commands',
		category: types.CAT_SYS,
		schema: {},
		returns: 'json',
		data: async params => {
			return await videocore.commands()
		}
	},
	{
		url: '/vcgencmd',
		type: 'post',	
		description: 'VideoCore GPU info via vcgencmd',
		category: types.CAT_SYS,
		schema: {
			args: {
				type: 'string',
				required: true,
				desc: 'run vcgencmd with arguments'
			}
		},
		returns: 'json',
		data: async params => {
			return await videocore.commands()
		}
	},
	{
		url: '/videocore',
		type: 'get',	
		description: 'report VideoCore GPU information',
		category: types.CAT_SYS,
		schema: {
		},
		returns: 'json',
		data: async params => {
			return await videocore.report()
		}
	}
]