<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="22" x2="12" y2="5" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <path d="M12 5l3-3" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 5l-3-3" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="17" cy="11" r="1.5" stroke={color} stroke-width="1.5"/>
  <path d="M12 14l5-3" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <rect x="5.5" y="15.5" width="3" height="3" stroke={color} stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M12 18H8.5" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
</svg>
