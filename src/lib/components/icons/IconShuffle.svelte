<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 3h5v5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 21h5v-5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4 7l4.5 0c2 0 3 1 4.5 5s2.5 5 4.5 5l3.5 0" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M21 3l-3.5 4c-2 2.5-3 3-4.5 5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4 17h4.5c1.5 0 2.5-.5 3.5-2" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
