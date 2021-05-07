<script>
	import { onMount } from 'svelte';
	import fetcher from 'fetcheriser'
	import { Table } from 'svelte-tabular-table'
	import { parse } from 'matchit'
	import svg from './svg.js'

	let endpoints = []
	let inited = false


	$: init = {
		data: endpoints,
		keys: ['url','category', 'type', 'permissions', 'description'],
		index: 'url'
	}

	let dimensions = {
		padding: 13,
		widths: [280,120,80,110],
		minwidth: 800
	}

	let features = {
		sortable: {
			key: 'category'
		}
	}

	$: classes = {
		filled: [ hash ]
	}

	let callbacks = {
		render: {
			cell: o => {
				const URL = o.key == 'url'
				const PERM = o.key == 'permissions'
				const v = PERM ? `<span class="${o.value ? 'cross' : ''} w1em h1em block" />` : o.value
				return `
					<a 
						class="unclickable fill"
						${URL ? 'target="_blank"' : ''}
						href="${URL ? o.value : '#'+o.item.url}">
					</a>
					<span class="
						${URL ? 'bb1-solid' : ''}
					">${v}</span>
				`
			}
		}
	}



	function onHashChange() {
		hash = window.location.hash.substring(1)
		if (!values[hash]) values[hash] = {}
		for (let i = 0; i < endpoints.length; i++) endpoints[i].selected = (endpoints[i]?.item?.url == hash)
		status = null
		waiting = false
		data = ''
		if (!components[hash]) components[hash] = parse( hash )
		whoami()
	}

	async function getPermissions() {

		for(let i = 0; i < endpoints.length; i++) {
			let e = endpoints[i]
			const res = await fetcher[e.type.toLowerCase()]( e.url, { ezapi_permissions: true  } )
			endpoints[i].permissions = res.ok || false
		}
	}

	onMount(async () => {
		const res = await fetch(`endpoints`)
		const types = ['get', 'post', 'put', 'delete']
		endpoints = (await res.json()).filter( e => types.indexOf(e.type) != -1 )
		setTimeout( e => {
			onHashChange()
			history = JSON.parse( window.localStorage.getItem( storage ) ) || []
			// history.forEach( h => console.log('LOAD', h.data) )
		}, 10)

		await getPermissions()
		inited = true

	})


	$: endpoint = endpoints.find( e => e.url == hash && hash != '' )


	function path_( url, args ) {
		if (args == undefined) return url
		const keys = Object.keys( args )
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i]
			if (i == 0) url += '?'
			if ( args[key] != undefined && args[key] != '' ) {
				url += `${key}=${encodeURIComponent(args[key])}`
				if (i != keys.length - 1) url += '&'
			}
		}
		return url
	}
	$: args = values[hash]
	$: regexed = '/' + ( components[hash] || [] ).map( c => c.value || c.val).join('/')
	$: path = path_( regexed, args)

	async function whoami() {
		who = (await fetcher.get( '/api/whoami' )).data
	}

	let timestamp
	let waiting = false
	let who = ''

	let history = []



	async function submit() {

		let copy = JSON.parse( JSON.stringify(args) )
		Object.keys( copy ).forEach( k => {
			const sch = endpoint.schema[ k ]
			if (sch.type == 'object' || sch.type == 'array') {
				try {
					copy[k] = eval( '(' + copy[k] + ')' )
					console.log(`[Overview]  parsed object / array ${k}:`, copy[k])
				} catch( err ) {
					console.warn(`[Overview]  couldn't parse ${k}:`, err.message, copy[k])
					copy[k] = null
				}
			}
		})
		timestamp = new Date()
		data = ''
		waiting = true
		const res = await fetcher[endpoint.type]( regexed, copy, false )
		status = res.status || res.code
		timer = ( new Date() - timestamp ) / 1000
		if (res.ok) {
			data = res.data
			let copy = history
			const entry = {
				...JSON.parse( JSON.stringify( saveable ) ),
				data: JSON.stringify( data ),
				status,
				timer: timer.toFixed(2),
				id: new Date() / 1000,
				timestamp: (new Date()).toISOString().substr(11, 8)
			}
			console.log('[Overview]  adding entry', entry.values)
			copy.push( entry )
			history = copy

			// history.forEach( h => console.log('SAVE', h.data) )
			window.localStorage.setItem( storage, JSON.stringify( history ) )
			index = 0

		}
		if (res.error) data = res.message
		setTimeout( e => waiting = false, 10)
	}
	let creds = {
		username: '',
		password: ''
	}
	let loginError = ''
	$: storage = window.location.host + window.location.pathname
	async function login( e ) {
		loginError = ''
		e.preventDefault()
		e.stopPropagation()
		const res = await fetcher.post( '/api/login', creds )
		if (res.ok) {
			await whoami()
			await getPermissions()
		} else {
			loginError = res?.message || res
		}
	}
	async function logout( e ) {
		e.preventDefault()
		e.stopPropagation()
		const res = await fetcher.post( '/api/logout' )
		if (res.ok) {
			await whoami()
			await getPermissions()
		} else {
			loginError = res?.message || res
		}
	}

	$: str = JSON.stringify(data, null, '\t')
		



	$: historyInit = {
		data: history.reverse() || [],
		keys: ['url', 'status', 'timer', 'timestamp'],
		index: 'id'
	}

	$: historyClasses = {
		filled: [ history[index]?.id ]
	}

	let historyDimensions = {
		padding: 13,
		widths: [null, 70, 60, 100]
	}

	let historyFeatures = {
	}

	let historyCallbacks = {
		click: {
			cell: o => {
				index = o.rowIndex
				const entry = history[index]
				const url = history[index].url
				components[url] = JSON.parse( JSON.stringify( entry.components ))
				values[url] = JSON.parse( JSON.stringify( entry.values ))
				data = JSON.parse( entry.data )
			}
		}
	}


	// ----------------

	let hash, status, timer // store
	let data = '' // store
	let values = {} // store
	let components = {} // store

	$: saveable = { url: hash, values: values[hash], components: components[hash] }
	
	// ----------------

	let index = -1

	function clear() {
		history = []
		window.localStorage.setItem( storage, null )

	}

	async function copy() {

		if (!navigator.clipboard) return
		await navigator.clipboard.writeText( str )
	}

	function compare( able, entry ) {
		if (!entry || !able) return
		const a = JSON.stringify( { url: entry.url, values: entry.values, components: entry.components } )
		const b = JSON.stringify( { url: able.url, values: able.values, components: able.components } )
		if (a != b) {
			const copy = history
			history = []
			index = -1
			history = copy
		}
	}

	$: compare( saveable, history[index] )

</script>

<svelte:window on:hashchange={onHashChange} />

<main class="flex column-stretch-stretch h100vh overflow-hidden">
	<div class="flex grow h100pc">
		<div class="flex column basis10pc br1-solid grow overflow-hidden h100vh">
			<div class="p1">
				<h4 class="bold flex">
					<span class="bb2-solid block">Application Programming Interface</span>
				</h4>
			</div>
			<div class:hidden={!inited} class="overflow-auto h100pc">
				<Table {init} {classes} {features} {callbacks} {dimensions} />
			</div>

			<div class="p1 bt1-solid flex column cmb1">
				<h4 class="flex bold">
					<span class="bb2-solid block">Auth</span>
				</h4>
				<div class:hidden={!inited} class="flex row-space-between-center">
					<div class="h2em">
						<span>Viewing as </span>
						<span class="bb1-solid inline-block bold">{who.username || ''}</span>
					</div>
					<div>
						{loginError} 
					</div>
				</div>
				<form 
					method="post" 
					action="/api/login" 
					class:hidden={!inited} 
					class:none={ who.loggedin }
					class="flex row">
					<input name="username" class="grow mr1" bind:value={creds.username} type="text" placeholder="username" />
					<input name="password" class="grow mr1" bind:value={creds.password} type="password" placeholder="password" />
					<button class="filled " on:click={login} >login</button>
				</form>
				<div
					class:none={ !who.loggedin }
					class="grow basis0em h100pc flex row-flex-start-stretch cmr1">
					<button class="filled" on:click={logout} >logout</button>
					<!-- <button class="" >permissions</button> -->
				</div>

			</div>
		</div>
		<div class="flex column no-basis br1-solid grow overflow-auto">

			<div class="p1">
				<h4 class="flex bold">
					<span class="bb2-solid block">Arguments</span>
				</h4>
			</div>
			{#if endpoint}
				<form class="flex column cmb1 p1" class:hidden={!inited} >
					{#if Object.keys(endpoint.schema).length == 0 }
						<div class="fade">
							N/A
						</div>
					{/if}
					{#each Object.entries(endpoint.schema) as [key, value]}
						<div class="bold">
							{key} {value.required ? '*' : ''}
							<span class="fade normal monospace">{value.type}</span>
						</div>
						{#if value.type == 'boolean'}
							<label class="checkbox">
								<input 
									bind:checked={ values[hash][key] }
									name={key}
									type="checkbox" 
									placeholder={key}
									required={value.required} />
								<span />
							</label>
						{:else if value.type == 'object' || value.type == 'array' }
							<textarea 
								bind:value={ values[hash][key] }
								name={key}
								class="monospace flex grow p0-6" 
								rows={'6'}
								required={value.required}
								placeholder={key} />
						{:else}
							<input 
								bind:value={ values[hash][key] }
								name={key}
								class="flex grow p0-6" 
								required={value.required} 
								placeholder={key} />
						{/if}
					{/each}
				</form>
			{:else}
				<div class="plr1 mb1 fade">N/A</div>
			{/if}


				<div class="flex column cmb1 p1 bt1-solid">
					<h4 class="flex bold">
						<span class="bb2-solid block">Endpoint</span>
					</h4>
					{#if endpoint}
						<p>{endpoint.description}</p>

						{#each components[hash] as piece}
							{#if piece.type > 0}
								<div class="bold">
									{piece.val}
								</div>
								<input 
									bind:value={ piece.value }
									name={ piece.val }
									type="text" 
									placeholder={ piece.val } />
							{/if}
						{/each}
						<input type="text" disabled={true} value={path} />
						<button 
							class="filled"
							disabled={waiting} 
							on:click={submit}>
							send	
						</button>
					{:else}
						<div class="fade">N/A</div>
					{/if}
				</div>
		</div>
		<div class="flex flex-column grow no-basis">



			<div class="overflow-hidden minh50vh maxh50vh h50vh flex column">
				<div class="p1 flex row-space-between-center">
					<h4 class="flex bold">
						<span class="bb2-solid block">Response</span>
					</h4>
					<button on:click={clear}>clear</button>
				</div>
				<div class="overflow-auto h100pc" class:hidden={!inited} >
					<Table 
						init={historyInit}
						classes={historyClasses}
						dimensions={historyDimensions}
						callbacks={historyCallbacks}
						features={historyFeatures} />
				</div>
			</div>
			<div class="flex column p1 bt1-solid overflow-hidden">
				<div class="flex row-space-between-center">
					<h4>
						<span class="bb2-solid block">Data</span>
					</h4>
					<button on:click={copy}>copy</button>
				</div>
				<div class="overflow-auto h100pc w100pc" class:hidden={!inited} >
					<pre class="mtb1 monospace w100pc" style="word-wrap: break-word;white-space: pre-wrap;">
						{@html waiting ? `<span class="fade">waiting...</span>` : str == '""' ? '' : str }
					</pre>
				</div>
				<!-- <div class="w8em h8em">{@html svg}</div> -->
			</div>

		</div>
	</div>
</main>
