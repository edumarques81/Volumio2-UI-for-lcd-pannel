<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 18V8a4 4 0 0 1 4-4h0" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M21 18V8a4 4 0 0 0-4-4h0" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 18a3 3 0 0 0 6 0" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M21 18a3 3 0 0 1-6 0" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 18V8" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <path d="M15 18V8" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
</svg>
