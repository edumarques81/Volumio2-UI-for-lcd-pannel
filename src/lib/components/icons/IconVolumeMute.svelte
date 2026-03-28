<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 5L6 9H2v6h4l5 4V5z" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="16" y1="9" x2="22" y2="15" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="22" y1="9" x2="16" y2="15" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
</svg>
