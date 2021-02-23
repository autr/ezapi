module.exports = {
	post: async function( url, args ) {
		console.log('[Overview] POST', url, args)

		for (const [key, value] of Object.entries(args)) {

			// use JSON parse to ensure proper type (object, string etc)

			try { args[key] = JSON.parse(value) } catch(err) { }
		}

		return await fetch(url,
		{
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    method: 'POST',
		    body: JSON.stringify(args)
		})
	},
	get: async function( url, args ) {
		console.log('[Overview] GET', url, args)
		return await fetch(url + params)
	}
}