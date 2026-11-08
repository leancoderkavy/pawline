import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

test('search tour supports first visit, dismissal, replay, keyboard and unavailable storage', async () => {
 const dir = await mkdtemp(join(process.cwd(),'.tour-test-'));
 try {
  const output = join(dir,'tour.mjs');
  await build({entryPoints:['src/SearchTour.jsx'],outfile:output,bundle:true,format:'esm',platform:'node',external:['react'],jsx:'automatic'});
  const {default:SearchTour} = await import(pathToFileURL(output));
  const dom = new JSDOM('<button id="before">Before</button><input id="target"><div id="root"></div>',{url:'https://pawline.test'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const root=createRoot(document.getElementById('root'));
  const render=async()=>act(async()=>root.render(React.createElement(SearchTour,{targetId:'target'})));
  await render();
  assert.ok(document.querySelector('[aria-label="Location search guide"]'));
  await act(async()=>document.querySelector('[data-tour-action="skip"]').click());
  assert.equal(document.querySelector('[aria-label="Location search guide"]'),null);
  await act(async()=>root.unmount());
  const second=createRoot(document.getElementById('root'));
  await act(async()=>second.render(React.createElement(SearchTour,{targetId:'target'})));
  assert.equal(document.querySelector('[aria-label="Location search guide"]'),null);
  const replay=document.querySelector('[data-tour-action="replay"]'); replay.focus();
  await act(async()=>replay.click());
  assert.ok(document.querySelector('[aria-label="Location search guide"]'));
  await act(async()=>document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(document.querySelector('[aria-label="Location search guide"]'),null);
  assert.equal(document.activeElement,replay);
  await act(async()=>second.unmount());
  Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});
  const third=createRoot(document.getElementById('root'));
  await act(async()=>third.render(React.createElement(SearchTour,{targetId:'target'})));
  await act(async()=>document.querySelector('[data-tour-action="done"]').click());
  assert.equal(document.activeElement.id,'target');
  await act(async()=>third.unmount());
  const missing=createRoot(document.getElementById('root'));
  await act(async()=>missing.render(React.createElement(SearchTour,{targetId:'missing'})));
  assert.equal(document.querySelector('[aria-label="Location search guide"]'),null);
  await act(async()=>missing.unmount());
  dom.window.close();
 } finally { await rm(dir,{recursive:true,force:true}); }
});
