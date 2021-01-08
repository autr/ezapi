<script>
	import { onMount } from 'svelte';

	let categories = []
	let endpoints = []
	let keyed = {}
	let oi = 'aaaa'

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
			keyed[ e.url ] = e
		})
		endpoints = endpoints.reverse().reverse()
		oi = 'bbbb'
	})


	let _current
	$: current = keyed[_current]
	let values = {}
</script>

<main>
	<div class="flex" style="height:100vh">
		<div class="flex flex-column grow no-basis br1-solid">

			<div class="p1 overflow-auto bb1-solid grow no-basis">

				<div class="plr1 ptb0-5"><span class="f4">API</span></div>
				{#each endpoints as ee, i}
					<div class="plr1 ptb0-4"><span class="f4">{categories[i]}</span></div>
					{#each ee as e, ii}
						<div 
							on:click={ a => _current = e.url }
							class:filled={ _current == e.url }
							class="flex justify-content-between plr1 ptb0-4 pointer">
							<div>
								<span class="f1 w40px inline-block">{e.type.toUpperCase()}</span> 
								{#if e.type != 'use' }
									<span>{e.url}</span>
								{:else}
									<span>{e.url || ''}</span>
								{/if} 
							</div>
							<div>	
								{e.description}
							</div>
						</div>
							<!-- {JSON.stringify(e)} -->
					{/each}
				{/each}
			</div>

		</div>
		<div class="flex flex-column grow no-basis">
			<div class="flex grow no-basis p1 overflow-auto bb1-solid">
				{#if current}
					<div class="f4 pb0-8">{current.url}</div>
					{#each Object.entries(current.schema || {}) as [key, value]}
						<input class="flex grow" required={value.required} bind:value={ values[key] } placeholder={value.desc} />
					{/each}
					{#if current.schema }<div><button>Send</button></div>{/if}
				{:else}
					No endpoint current.
				{/if}
			</div>
			<div class="flex grow no-basis p1 overflow-auto">

			</div>

		</div>
	</div>
</main>
