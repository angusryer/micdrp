/**
 * ACC-NOTES-240 / INV-NOTES-226 — a sheet over the graph leaves the whole
 * graph above it.
 *
 * Choosing a note opens a sheet describing it, and the note being described
 * was then behind that sheet: the edit had to be made blind, or the page
 * scrolled by hand first, every time.
 */
import { graphHeightFor, MIN_GRAPH_CARD } from '../graphRoom';

const page = { viewportPx: 800, usualPx: 400, headerPx: 0 };

it('leaves the graph as it was while nothing covers the page', () => {
  expect(graphHeightFor({ ...page, coveredPx: 0 })).toBe(400);
});

it('ACC-NOTES-240: fits the graph in the room above the sheet', () => {
  // 800 tall, 500 of it covered: the graph takes what is left rather than
  // the half-screen it would otherwise have.
  expect(graphHeightFor({ ...page, coveredPx: 500 })).toBe(300);
});

it('never grows past the share it has uncovered', () => {
  // A shallow sheet leaves more room than the graph normally takes. A sheet
  // is not a reason for the drawing to get bigger.
  expect(graphHeightFor({ ...page, coveredPx: 100 })).toBe(400);
});

it('stops at the least a graph can be drawn in', () => {
  // Dragged to the top of the screen. The answer to no room is a page that
  // scrolls, not a drawing squeezed to a line.
  expect(graphHeightFor({ ...page, coveredPx: 780 })).toBe(MIN_GRAPH_CARD);
});

it('gives way to whatever sits above it', () => {
  expect(graphHeightFor({ ...page, coveredPx: 500, headerPx: 60 })).toBe(240);
});
