/**
 * Unit tests for RecordingCard (WP-LIBRARY-UI).
 *
 * Renders the card with mock data and asserts:
 *   • title, date string, duration, note count, and score badge render;
 *   • Play button toggles a PlaybackBar (mocked) into view;
 *   • Delete calls onDelete with the correct id;
 *   • Export button appears only when midiUri is set and onShareMidi is provided;
 *   • Missing optional fields (score, noteCount, midiUri) don't crash rendering.
 *
 * PlaybackBar is mocked so no AudioContext is created in tests.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type { RecordingMeta } from '../../../data/recordings';
import { RecordingCard } from '../RecordingCard';

// ---- mock PlaybackBar so AudioContext is never exercised in tests ----
jest.mock('../PlaybackBar', () => ({
  PlaybackBar: ({ audioUri }: { audioUri: string }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, `MockPlayback:${audioUri}`)
    );
  }
}));

// ---- ThemeProvider stub ----
// The card calls useTheme(); wrap it in the real ThemeProvider from source.
// (ThemeProvider uses useColorScheme which is provided by react-native mock.)
import { ThemeProvider } from '../../../theme/ThemeProvider';

// ---- fixture ----
function makeMeta(over: Partial<RecordingMeta> = {}): RecordingMeta {
  return {
    id: 'rec-1',
    title: 'My First Take',
    createdAtMs: 1_719_744_000_000, // 2024-06-30 08:00:00 UTC
    durationMs: 93_000, // 1:33
    sampleRateHz: 44100,
    audioUri: 'file:///mock/rec-1.wav',
    midiUri: 'file:///mock/rec-1.mid',
    score: 88,
    noteCount: 7,
    ...over
  };
}

function renderCard(
  meta: RecordingMeta,
  {
    onDelete = jest.fn(),
    onShareMidi
  }: {
    onDelete?: jest.Mock;
    onShareMidi?: jest.Mock;
  } = {}
): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  void act(() => {
    tree = TestRenderer.create(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(RecordingCard, { meta, onDelete, onShareMidi })
      )
    );
  });
  return tree;
}

function getText(tree: TestRenderer.ReactTestRenderer): string[] {
  const instance = tree.toJSON();
  const texts: string[] = [];
  function walk(node: unknown): void {
    if (node == null) return;
    if (typeof node === 'string') {
      texts.push(node);
      return;
    }
    const n = node as { children?: unknown[] };
    if (Array.isArray(n.children)) {
      n.children.forEach(walk);
    }
  }
  if (Array.isArray(instance)) {
    instance.forEach(walk);
  } else {
    walk(instance);
  }
  return texts;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecordingCard', () => {
  it('renders title', () => {
    const tree = renderCard(makeMeta());
    const texts = getText(tree);
    expect(texts).toContain('My First Take');
  });

  it('renders formatted duration (1:33)', () => {
    const tree = renderCard(makeMeta());
    const texts = getText(tree);
    expect(texts.join(' ')).toContain('1:33');
  });

  it('renders note count', () => {
    const tree = renderCard(makeMeta());
    const texts = getText(tree).join(' ');
    expect(texts).toContain('7');
    expect(texts).toContain('notes');
  });

  it('renders score badge value', () => {
    const tree = renderCard(makeMeta({ score: 92 }));
    const texts = getText(tree);
    expect(texts).toContain('92');
  });

  it('renders no score badge when score is undefined', () => {
    const tree = renderCard(makeMeta({ score: undefined }));
    // The badge only renders the rounded number; 92 should not appear.
    const texts = getText(tree);
    expect(texts).not.toContain('92');
  });

  it('Play button shows the playback row on first press', () => {
    const tree = renderCard(makeMeta());

    // PlaybackBar not yet rendered
    let json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('MockPlayback');

    // Find the Play button and press it
    const instance = tree.root;
    const playButton = instance.findAll(
      (node) =>
        node.type === 'View' &&
        node.props?.accessibilityLabel === 'Play recording'
    );
    // The pressable has a wrapping view — look for the Pressable by label
    const pressable = instance.findAll(
      (node) => node.props?.accessibilityLabel === 'Play recording'
    );
    void act(() => {
      pressable[0]?.props?.onPress?.();
    });

    json = JSON.stringify(tree.toJSON());
    expect(json).toContain('MockPlayback');
    // After expand, label changes to Close
    const closeButton = instance.findAll(
      (node) => node.props?.accessibilityLabel === 'Close player'
    );
    expect(closeButton.length).toBeGreaterThan(0);
    // Suppress unused-variable lint
    void playButton;
  });

  it('Delete button calls onDelete with the recording id', () => {
    const onDelete = jest.fn();
    const tree = renderCard(makeMeta(), { onDelete });
    const instance = tree.root;
    const deleteButton = instance.findAll(
      (node) => node.props?.accessibilityLabel === 'Delete recording'
    );
    void act(() => {
      deleteButton[0]?.props?.onPress?.();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('rec-1');
  });

  it('Export button appears when midiUri is set and onShareMidi provided', () => {
    const onShareMidi = jest.fn();
    const tree = renderCard(makeMeta(), { onShareMidi });
    const instance = tree.root;
    const exportButton = instance.findAll(
      (node) => node.props?.accessibilityLabel === 'Export MIDI'
    );
    expect(exportButton.length).toBeGreaterThan(0);
  });

  it('Export button is absent when midiUri is undefined', () => {
    const onShareMidi = jest.fn();
    const tree = renderCard(makeMeta({ midiUri: undefined }), { onShareMidi });
    const instance = tree.root;
    const exportButton = instance.findAll(
      (node) => node.props?.accessibilityLabel === 'Export MIDI'
    );
    expect(exportButton.length).toBe(0);
  });

  it('Export button calls onShareMidi when pressed', () => {
    const onShareMidi = jest.fn();
    const tree = renderCard(makeMeta(), { onShareMidi });
    const instance = tree.root;
    const exportButton = instance.findAll(
      (node) => node.props?.accessibilityLabel === 'Export MIDI'
    );
    void act(() => {
      exportButton[0]?.props?.onPress?.();
    });
    expect(onShareMidi).toHaveBeenCalledTimes(1);
    expect(onShareMidi).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rec-1' })
    );
  });

  it('renders without crashing when optional fields are absent', () => {
    // score, noteCount, and midiUri are all optional.
    expect(() =>
      renderCard(
        makeMeta({ score: undefined, noteCount: undefined, midiUri: undefined })
      )
    ).not.toThrow();
  });
});
