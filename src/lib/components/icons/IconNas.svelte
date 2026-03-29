<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="18" height="6" rx="1.5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="3" y="13" width="18" height="6" rx="1.5" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="12" y1="9" x2="12" y2="13" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="7" cy="6" r="0.75" fill={color}/>
  <circle cx="7" cy="16" r="0.75" fill={color}/>
</svg>
