<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 20v-8" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="1" fill={color}/>
  <path d="M8.46 8.46a6 6 0 0 0 0 8.49" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15.54 8.46a6 6 0 0 1 0 8.49" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.64 5.64a11 11 0 0 0 0 13.13" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18.36 5.64a11 11 0 0 1 0 13.13" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
