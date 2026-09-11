import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollFx, heroParallax } from '../js/lib/motion.js';

const fx = (y) => scrollFx(y, 800, 3000);

test('top of page is the resting state', () => {
  assert.deepEqual(fx(0), {
    bar: { transform: 'scaleX(0)' },
    bg: { transform: 'scale(1.3) translateY(-5%)' },
    inner: { opacity: '1', transform: 'translateY(0px) scale(1)' },
    thumbs: { opacity: '1', transform: 'translate3d(0px, 0px, 0) rotate(0deg)' },
  });
});

test('ranges match the CSS scroll timeline', () => {
  assert.deepEqual(fx(40).inner, { opacity: '1', transform: 'translateY(0px) scale(1)' });
  assert.deepEqual(fx(200).inner, { opacity: '0.5', transform: 'translateY(-24px) scale(0.96)' });
  assert.deepEqual(fx(360).inner, { opacity: '0', transform: 'translateY(-48px) scale(0.92)' });
  assert.deepEqual(fx(300).thumbs, { opacity: '0', transform: 'translate3d(60px, -20px, 0) rotate(7deg)' });
  assert.equal(fx(480).bg.transform, 'scale(1.12) translateY(5%)');
  assert.equal(fx(1100).bar.transform, 'scaleX(0.5)');
});

test('values clamp past the end of each range', () => {
  assert.deepEqual(fx(5000).bg, fx(480).bg);
  assert.deepEqual(fx(5000).inner, fx(360).inner);
  assert.equal(fx(5000).bar.transform, 'scaleX(1)');
});

test('a page shorter than the viewport does not divide by zero', () => {
  assert.equal(scrollFx(0, 800, 600).bar.transform, 'scaleX(0)');
});

test('hero parallax never uncovers an edge', () => {
  for (let step = 0; step <= 100; step += 1) {
    const { scale, translate } = heroParallax(step / 100);
    const shift = scale * Math.abs(translate);
    const overflow = ((scale - 1) / 2) * 100;
    assert.ok(shift <= overflow + 1e-9, `progress ${step / 100}: shift ${shift}% > overflow ${overflow}%`);
  }
});
