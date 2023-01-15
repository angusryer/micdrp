import { render } from '@testing-library/react-native';
import React from 'react';
import 'react-native';
import App from '../App';

/**
 * If using react-test-renderer, notet that it must be required after react-native.
 * import renderer from 'react-test-renderer';
 */

it('renders correctly', () => {
  render(<App />);
});
