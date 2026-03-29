<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="3" y1="6" x2="21" y2="6" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="12" x2="21" y2="12" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="18" x2="11" y2="18" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <path d="M15 15v8l6-4-6-4z" fill={color} stroke={color} stroke-width="1.5" stroke-linejoin="round"/>
</svg>
