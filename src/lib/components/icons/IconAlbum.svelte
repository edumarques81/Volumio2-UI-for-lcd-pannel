<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke={color} stroke-width="1.5"/>
  <circle cx="12" cy="12" r="3" stroke={color} stroke-width="1.5"/>
  <circle cx="12" cy="12" r="0.75" fill={color}/>
</svg>
