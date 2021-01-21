<script>
	import { onMount } from 'svelte';

	let categories = []
	let endpoints = []
	let keyed = {}

	onMount(async () => {
		const res = await fetch(`/endpoints`)
		const json = await res.json()
		json.forEach( e => {
			const k = e.category
			let idx = categories.indexOf(k)
			if (idx == -1) {
				categories.push( k )
				endpoints.push( [] )
			}
			idx = categories.indexOf(k)
			endpoints[idx].push( e )
			keyed[ e.type + e.url + e.description ] = e
		})
		endpoints = endpoints.reverse().reverse()
	})


	let _current
	$: current = keyed[_current]
	let values = {}
	function setParams() {
		if (!current) return (params = '')
		params = '?'
		const keys = Object.keys(current.schema)
		for (let i = 0; i < keys.length; i++) {
			const  k = keys[i]
			if (values[k]) params += `${ i == 0 ? '' : '&' }${k}=${values[k]}`
		}
	}
	let params = ''
	let permissions = false

	let formEl

	async function post( url, args ) {
		console.log('[Overview] POST', url, args)

		for (const [key, value] of Object.entries(args)) {
			try {
				args[key] = JSON.parse(value)
			} catch(err) {
				
			}
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
	}
	async function get( url, args ) {
		console.log('[Overview] GET', url, args)
		return await fetch(url + params)
	}

	let response
	let waiting = false

	async function send( e ) {
		e.preventDefault()
		e.stopPropagation()
		response = ''
	    const form = new FormData(formEl)
		const args = Object.fromEntries(form.entries())
		waiting = true
		if (current.type == 'get') response = await (await get( current.url, args )).json()
		if (current.type == 'post') response = await (await post( current.url, args )).json()
		waiting = false
	}

	$: responseStr = ( typeof(response) == 'object' || typeof(response) == 'array' ) ? JSON.stringify(response, null, 2) : response
</script>

<main>
	<div class="flex h100vh no-basis">
		<div class="flex flex-column grow br1-solid no-basis">

			<div class="ptb1 overflow-auto bb1-solid">

				<div class="flex plr2 ptb0-4 align-items-flex-end justify-content-between">
					<div class="f4">API</div>
					<button 
						class:filled={permissions}
						on:click={e => permissions = !permissions}>
						Permissions
					</button>
				</div>
				{#each endpoints as ee, i}
					<div class="plr2 ptb0-4"><span class="f4">{categories[i]}</span></div>
					{#each ee as e, ii}
						{#if e.type == 'get' || e.type == 'post' || e.type == 'ws' }
							<div 
								on:click={ a => (_current = e.type + e.url + e.description) && (response = '') }
								class:pop={ _current == e.type + e.url + e.description }
								class="flex justify-content-between plr2 ptb0-4 pointer align-items-center">
								<div class="flex align-items-center">
									<div class="f1 w40px inline-block">{e.type.toUpperCase()}</div> 
									{#if e.type =='get'}
										<a
											href={e.url}
											target="_blank"
											class="sink highlight plr0-8 ptb0-4">{e.url}</a>
									{:else}
										<div class="sink highlight plr0-8 ptb0-4">{e.url}</div>
									{/if} 
									{#each Object.entries(e.schema || {}) as [key, value]}
										<div class="pop plr0-8 ptb0-4 fade">{key}</div>
									{/each}
								</div>
								<div>	
									{e.description}
								</div>
							</div>
						{/if}
					{/each}
				{/each}
			</div>
		</div>
		<div class="flex flex-column grow no-basis">


			<div class="ptb1 basis-auto bb1-solid" style="flex-basis: auto">
				<div class="plr2 ptb0-4"><span class="f4">Endpoint</span></div>
				<div class="p2">
					{#if current}
						<form bind:this={formEl}>
							{#each Object.entries(current.schema || {}) as [key, value]}
								<div class="flex align-items-center pb0-8">
									<div class="basis80px">{key}{value.required ? '*' : ''}</div>
									{#if value.type == 'boolean'}
										<input 
											name={key}
											type="checkbox" 
											required={value.required} 
											bind:value={ values[key] } />
									{:else if value.type == 'object' || value.type == 'array' }
										<textarea 
											name={key}
											class="flex grow p0-6" 
											rows={'6'}
											required={value.required} 
											bind:value={ values[key] } 
											on:keyup={setParams} 
											placeholder={value.desc} />
									{:else}
										<input 
											name={key}
											class="flex grow p0-6" 
											required={value.required} 
											bind:value={ values[key] } 
											on:keyup={setParams} 
											placeholder={value.desc} />
									{/if}
								</div>
							{/each}
							<div class="flex align-items-flex-end justify-content-between">
								<div class="f3">
									{current.url}{#if current.type == 'get'}<span>{params}</span>{/if}
								</div>
								<button disabled={waiting} class="ptb0-4 plr1" on:click={send}>{(waiting) ? 'waiting' : current.type.toUpperCase()}</button>
							</div>
						</form>
					{:else}
						<div>No endpoint current.</div>
					{/if}
				</div>
			</div>

			<div class="ptb1 grow overflow-auto">
				<div class="plr2 ptb0-4"><span class="f4">Response</span></div>
				<div class="p2" style="font-family:monospace;white-space:pre-wrap">{@html (waiting) ? 'waiting' : responseStr || '~' }</div>
			</div>

		</div>
	</div>
</main>
