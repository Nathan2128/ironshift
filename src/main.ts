import './style.css';
import { App } from './app';

const app = new App(document.getElementById('stage')!);
app.boot();

if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;
