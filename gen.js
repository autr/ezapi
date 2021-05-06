const crypto = require('crypto')

async function run() {

	const EZAPI_KEY = crypto.randomBytes(64).toString('hex')
	
	const env = {
		EZAPI_ADMIN: 'g@sinnott.cc',
		EZAPI_KEY,
		EZAPI_PASSWORD: await crypto.scryptSync( process.argv[2], EZAPI_KEY, 64).toString('hex')
	}


	for (const [key, value] of Object.entries(env)) {
		console.log( key + '=' + value )
	}

}

run()