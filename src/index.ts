import { World, stencilMaterial } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BazaarSystem } from './systems/bazaar-system.js';
import { WelcomeSystem } from './systems/welcome-system.js';
import './styles.css';

if (new URLSearchParams(location.search).has('bare')) {
  document.documentElement.classList.add('bare');
}

// The stock 1.2 mm hand outline vanishes against the dark stall at a seated
// distance; the rim width is this inset, so widen it to keep gestures legible.
stencilMaterial.uniforms.outlineThickness.value = 0.0032;

const container = document.getElementById('scene-container');
if (!(container instanceof HTMLDivElement)) {
  throw new Error('Missing #scene-container');
}

World.create(container, projectOptions).then((world) => {
  world.registerSystem(WelcomeSystem);
  world.registerSystem(BazaarSystem, { priority: 5 });
});
