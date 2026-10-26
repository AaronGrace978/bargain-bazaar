import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BazaarSystem } from './systems/bazaar-system.js';
import { WelcomeSystem } from './systems/welcome-system.js';
import './styles.css';

if (new URLSearchParams(location.search).has('bare')) {
  document.documentElement.classList.add('bare');
}

const container = document.getElementById('scene-container');
if (!(container instanceof HTMLDivElement)) {
  throw new Error('Missing #scene-container');
}

World.create(container, projectOptions).then((world) => {
  world.registerSystem(WelcomeSystem);
  world.registerSystem(BazaarSystem, { priority: 5 });
});
