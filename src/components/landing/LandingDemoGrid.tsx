"use client";

import { useEffect, useRef, type FocusEvent, type PointerEvent } from "react";

const tileCount = 42;

function makeWave(grid: HTMLDivElement, clientX: number, clientY: number, reducedMotion: boolean) {
  const tiles = Array.from(grid.querySelectorAll<HTMLButtonElement>("[data-demo-tile]"));
  if (!tiles.length) return;

  const rects = tiles.map((tile) => tile.getBoundingClientRect());
  if (reducedMotion) {
    const nearest = rects.reduce((best, rect, index) => {
      const dx = rect.left + rect.width / 2 - clientX;
      const dy = rect.top + rect.height / 2 - clientY;
      const distance = dx * dx + dy * dy;
      return distance < best.distance ? { index, distance } : best;
    }, { index: -1, distance: Number.POSITIVE_INFINITY }).index;
    tiles.forEach((tile, index) => tile.classList.toggle("is-wave-center", index === nearest));
    return;
  }

  const radius = Math.max(rects[0].width * 1.55, 20);
  tiles.forEach((tile, index) => {
    const rect = rects[index];
    const dx = rect.left + rect.width / 2 - clientX;
    const dy = rect.top + rect.height / 2 - clientY;
    const weight = Math.exp(-((dx * dx + dy * dy) / (2 * radius * radius)));
    const lift = weight * 8;
    tile.style.setProperty("--wave-y", `${-lift.toFixed(2)}px`);
    tile.style.setProperty("--wave-z", `${(lift * 0.72).toFixed(2)}px`);
    tile.style.setProperty("--wave-scale", `${(1 + weight * 0.035).toFixed(4)}`);
    tile.style.setProperty("--wave-weight", weight.toFixed(3));
    tile.style.setProperty("--wave-brightness", `${(1 + weight * 0.16).toFixed(3)}`);
    tile.classList.toggle("is-wave-center", weight > 0.78);
  });
}

function clearWave(grid: HTMLDivElement) {
  grid.querySelectorAll<HTMLButtonElement>("[data-demo-tile]").forEach((tile) => {
    tile.style.setProperty("--wave-y", "0px");
    tile.style.setProperty("--wave-z", "0px");
    tile.style.setProperty("--wave-scale", "1");
    tile.style.setProperty("--wave-weight", "0");
    tile.style.setProperty("--wave-brightness", "1");
    tile.classList.remove("is-wave-center");
  });
}

function settleWave(grid: HTMLDivElement, frameRef: { current: number | null }, touchTimeoutRef: { current: number | null }) {
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
  if (touchTimeoutRef.current !== null) {
    window.clearTimeout(touchTimeoutRef.current);
    touchTimeoutRef.current = null;
  }
  grid.classList.add("is-settling");
  clearWave(grid);
}

export function LandingDemoGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const touchTimeoutRef = useRef<number | null>(null);
  const touchActiveRef = useRef(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reducedMotionRef.current = media.matches;
      gridRef.current?.classList.toggle("is-reduced-motion", media.matches);
      if (media.matches && gridRef.current) {
        gridRef.current.classList.remove("is-settling");
        clearWave(gridRef.current);
      }
    };
    updateMotionPreference();
    media.addEventListener("change", updateMotionPreference);
    return () => media.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    if (touchTimeoutRef.current !== null) window.clearTimeout(touchTimeoutRef.current);
  }, []);

  function scheduleWave(grid: HTMLDivElement, x: number, y: number) {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    if (touchTimeoutRef.current !== null) {
      window.clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
    grid.classList.remove("is-settling");
    frameRef.current = window.requestAnimationFrame(() => {
      makeWave(grid, x, y, reducedMotionRef.current);
      frameRef.current = null;
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    touchActiveRef.current = false;
    scheduleWave(event.currentTarget, event.clientX, event.clientY);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") settleWave(event.currentTarget, frameRef, touchTimeoutRef);
  }

  function handleTilePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch") return;
    const grid = gridRef.current;
    if (!grid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    touchActiveRef.current = true;
    scheduleWave(grid, rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (touchTimeoutRef.current !== null) window.clearTimeout(touchTimeoutRef.current);
    touchTimeoutRef.current = window.setTimeout(() => {
      touchTimeoutRef.current = null;
      touchActiveRef.current = false;
      if (gridRef.current) settleWave(gridRef.current, frameRef, touchTimeoutRef);
    }, 1150);
  }

  function handleFocus(event: FocusEvent<HTMLButtonElement>) {
    if (touchActiveRef.current) return;
    const grid = gridRef.current;
    if (!grid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    scheduleWave(grid, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) settleWave(event.currentTarget, frameRef, touchTimeoutRef);
  }

  return (
    <div aria-label="Interactive 30 day plan grid demonstration" className="instrument-grid" onBlur={handleBlur} onPointerLeave={handlePointerLeave} onPointerMove={handlePointerMove} ref={gridRef}>
      {Array.from({ length: tileCount }, (_, index) => {
        const isSilver = [19, 25, 32].includes(index);
        const isBlue = index === 18;
        return <button
          aria-label={`Demonstration tile ${index + 1}${isBlue ? ", active blue indicator" : isSilver ? ", completed silver indicator" : ""}`}
          className={`instrument-tile${isSilver ? " is-silver" : ""}${isBlue ? " is-blue" : ""}`}
          data-demo-tile
          key={index}
          onFocus={handleFocus}
          onPointerDown={handleTilePointerDown}
          type="button"
        />;
      })}
    </div>
  );
}
