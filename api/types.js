module.exports = {

	// logger types

	API_ERR: 'error',
	API_TRY: 'try',
	API_SUCCESS: 'success',
	API_OPEN: 'open',
	API_STDOUT: 'stdout',
	API_STDERR: 'stderr',
	API_CLOSE: 'close',

	// categories

	CAT_CONF: 'configuration',
	CAT_FILE: 'filesystem',
	CAT_AUTH: 'authentication',
	CAT_SYS: 'system',
	CAT_NET: 'network',
	CAT_PROC: 'processes',
	CAT_MEDIA: 'media'
}

// const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT:, API_STDERR, API_CLOSE, CAT_FILE, CAT_AUTH, CAT_SYS, CAT_NET, CAT_PROC, CAT_MEDIA } = require('./types.js')