<script>
	import { onMount } from 'svelte';
	import fetcher from 'fetcher'
	import { Table } from 'svelte-tabular-table'
	import { parse } from 'matchit'

	let endpoints = []

	onMount(async () => {
		const res = await fetch(`endpoints`)
		const types = ['get', 'post', 'put', 'delete']
		endpoints = (await res.json()).filter( e => types.indexOf(e.type) != -1 )
	})



	$: init = {
		data: endpoints,
		keys: ['category', 'type', 'url','description'],
		index: 'url'
	}

	let dimensions = {
		padding: 0.1,
		widths: [100,60, 200]
	}

	let callbacks = {
		render: {
			cell: o => {
				let fill = `p1 unclickable flex row-flex-start-center`
				if (o.item.url == hash) fill += ' filled'
				if (o.key == 'url') return `
					<a class="${fill}" href="${o.value}" target="_blank">
						<span class="bb1-solid">${o.value}</span>
					</a>
				`
				return `
					<a class="${fill}" href="#${o.item.url}">${o.value}</a>
				`
			},
			key: o => {
				return `
					<span class="p1 block bold">${o.value}</span>
				`
			}
		}
	}

	let timestamp, timer, status
	let waiting = false
	let values = {}
	let hash, data = ''
	let components = []
	onHashChange()

	function onHashChange() {
		hash = window.location.hash.substring(1)
		if (!values[hash]) values[hash] = {}
		for (let i = 0; i < endpoints.length; i++) endpoints[i].selected = (endpoints[i]?.item?.url == hash)
		status = null
		waiting = false
		data = ''
		components = parse( hash )
	}

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
	$: regexed = '/' + components.map( c => c.value || c.val).join('/')
	$: path = path_( regexed, args)

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
		if (res.ok) data = res.data
		if (res.error) data = res.message
		waiting = false
		timer = ( new Date() - timestamp ) / 1000
	}

	$: str = JSON.stringify(data, null, 2)
</script>

<svelte:window on:hashchange={onHashChange} />

<main class="flex column-stretch-stretch h100vh">
	<div class="flex grow">
		<div class="flex column no-basis br1-solid grow overflow-auto">
			<div class="p1">
				<h4 class="bold">Endpoints</h4>
			</div>
			<Table {init} {callbacks} {dimensions} />
		</div>
		<div class="flex column no-basis br1-solid grow overflow-auto">

			{#if endpoint}
				<form class="flex column cmb1 p1">
					<h4 class="bold">Arguments</h4>
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
							<input 
								bind:value={ values[hash][key] }
								name={key}
								type="checkbox" 
								placeholder={key}
								required={value.required} />
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


				<div class="flex column cmb1 p1 bt1-solid">
					<h4 class="bold">Endpoint</h4>
					<p>{endpoint.description}</p>

					{#each components as piece}
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
						Send	
					</button>
				</div>
			{:else}
				<div>No endpoint current.</div>
			{/if}
		</div>
		<div class="flex flex-column grow no-basis">



			<div class="p1">
				<h4 class="bold">Response</h4>
				<p class="mtb1">
					{#if timer && status }
						<span class="bold">{ status }</span>
						in { timer.toFixed(2) }s 
						from <a 
								target="_blank"
								href={ hash }
								class="bb1-solid inline-block">{ hash }</a>
					{:else}
						<span class="fade">N/A</span>
					{/if}
				</p>
			</div>
			<div class="p1 bt1-solid overflow-auto">
				<h4 class="bold">Data</h4>
				<pre class="pre mtb1 monospace" style={`
					white-space:normal;
					word-break:break-word;
				`}>
					{@html waiting ? `<span class="fade">waiting...</span>` : str }
				</pre>
			</div>

		</div>
	</div>
	<div class="flex p1 bt1-solid">
		<input type="text" placeholder="username" />
		<input type="password" placeholder="password" />
		<button>login</button>
	</div>
</main>
