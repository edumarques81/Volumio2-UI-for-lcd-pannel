<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="8" height="8" rx="1.5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="13" y="13" width="8" height="8" rx="1.5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
