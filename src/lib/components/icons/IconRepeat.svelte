<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M17 2l3 3-3 3" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 11V9a4 4 0 0 1 4-4h13" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7 22l-3-3 3-3" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M21 13v2a4 4 0 0 1-4 4H4" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
