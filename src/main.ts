import './app.css';
import { mount } from 'svelte';
import { initConfig } from '$lib/config';

await initConfig();

const { default: App } = await import('./App.svelte');

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
