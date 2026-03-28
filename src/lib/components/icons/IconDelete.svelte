<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 6h18" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="10" y1="11" x2="10" y2="17" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="14" y1="11" x2="14" y2="17" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
</svg>
