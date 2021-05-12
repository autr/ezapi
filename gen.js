const crypto = require('crypto')
const prompt = require('password-prompt')

async function run() {

	let passwordA = await prompt('password: ', { method: 'hide' })
	let passwordB = await prompt('confirm password: ', { method: 'hide' })

	if (passwordA != passwordB) return console.error('error: passwords do not match')
	if (passwordA.length < 6) return console.error('error: password must have minimum 6 chars')

	const KEY = crypto.randomBytes(64).toString('hex')
	
	const env = {
		KEY,
		PASS: await crypto.scryptSync( passwordA, KEY, 64).toString('hex')
	}

	for (const [key, value] of Object.entries(env)) {
		console.log( key + '=' + value )
	}
}

run()