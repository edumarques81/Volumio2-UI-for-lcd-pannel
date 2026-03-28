<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="3" y1="6" x2="21" y2="6" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="12" x2="21" y2="12" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="18" x2="12" y2="18" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="18" y1="15" x2="18" y2="21" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="15" y1="18" x2="21" y2="18" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
</svg>
