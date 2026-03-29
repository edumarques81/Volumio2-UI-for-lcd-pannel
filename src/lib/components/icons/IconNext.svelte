<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 5l7 7-7 7V5z" fill={color} stroke={color} stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M13 5l7 7-7 7V5z" fill={color} stroke={color} stroke-width="1.5" stroke-linejoin="round"/>
</svg>
