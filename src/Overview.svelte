<script>
	import { onMount } from 'svelte';

	let categories = []
	let endpoints = []
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
		})
		endpoints = endpoints.reverse().reverse()
		oi = 'bbbb'
	})
</script>

<main>
	<div class="flex" style="height:100vh">
		<div class="flex flex-column grow no-basis br1-solid overflow-auto">
			<div class="plr1 ptb0-5"><span class="f4">API</span></div>
			{#each endpoints as ee, i}
				<div class="plr1 ptb0-4"><span class="f4">{categories[i]}</span></div>
				{#each ee as e}
					<div class="flex justify-content-between plr1 ptb0-4 pointer">
						<div>
							<span class="f1 w40px inline-block">{e.type.toUpperCase()}</span> 
							{#if e.type != 'use' }
								<a href={e.url}>{e.url}</a>
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
		<div class="flex flex-column grow no-basis">
			<div class="flex grow no-basis p1 overflow-auto bb1-solid">

			</div>
			<div class="flex grow no-basis p1 overflow-auto">

			</div>

		</div>
	</div>
</main>
