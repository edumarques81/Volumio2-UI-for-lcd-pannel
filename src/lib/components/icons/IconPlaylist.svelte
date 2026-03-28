<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="3" y1="6" x2="15" y2="6" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="11" x2="15" y2="11" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="16" x2="11" y2="16" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="18.5" cy="17.5" r="2.5" stroke={color} stroke-width="1.5"/>
  <path d="M21 17.5V10" stroke={color} stroke-width="1.5" stroke-linecap="round"/>
</svg>
