<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="9" cy="5" r="1.25" fill={color}/>
  <circle cx="15" cy="5" r="1.25" fill={color}/>
  <circle cx="9" cy="12" r="1.25" fill={color}/>
  <circle cx="15" cy="12" r="1.25" fill={color}/>
  <circle cx="9" cy="19" r="1.25" fill={color}/>
  <circle cx="15" cy="19" r="1.25" fill={color}/>
</svg>
