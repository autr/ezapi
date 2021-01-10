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
			keyed[ e.type + e.url + e.desc ] = e
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
			if (values[k]) params += `${ i == 0 ? '' : ',' }${k}=${values[k]}`
		}
	}
	let params = ''
	let permissions = false


	function send() {
		
	}
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
								on:click={ a => _current = e.type + e.url + e.desc }
								class:pop={ _current == e.type + e.url + e.desc }
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
						{#each Object.entries(current.schema || {}) as [key, value]}
							<div class="flex align-items-center pb0-8">
								<div class="basis80px">{key}{value.required ? '*' : ''}</div>
								{#if value.type == 'boolean'}
									<input 
										type="checkbox" 
										required={value.required} 
										bind:value={ values[key] } />
								{:else}
									<input 
										class="flex grow" 
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
							<button class="ptb0-4 plr1" on:click={send}>Send {current.type.toUpperCase()}</button>
						</div>
					{:else}
						<div>No endpoint current.</div>
					{/if}
				</div>
			</div>

			<div class="ptb1 flex grow overflow-auto">
				<div class="plr2 ptb0-4"><span class="f4">Response</span></div>

			</div>

		</div>
	</div>
</main>
