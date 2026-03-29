<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="8" cy="18" r="3" stroke={color} stroke-width="1.5"/>
  <path d="M11 18V4l9-2v14" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="17" cy="16" r="3" stroke={color} stroke-width="1.5"/>
</svg>
