import React, { PureComponent, ReactElement } from 'react';
import { Text, View } from 'react-native';
import AppError from '../utilities/errors';

interface ErrorBoundaryProps {
  children: ReactElement;
}

interface State {
  error: AppError | undefined;
}

export default class ErrorBoundary extends PureComponent<ErrorBoundaryProps> {
  state: State = {
    error: undefined
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: new AppError(error)
    };
  }

  /**
   * @param error - unknown error type
   * @param errorInfo - { componentStack }: ErrorInfo
   * */
  async componentDidCatch() {
    // const appError = new AppError(error, { stack: componentStack });
    // Send to log endpoint
  }

  restartApp() {
    // Possibly deal with user credentials before restarting?
    // RNRestart.Restart();
  }

  render() {
    if (this.state.error) {
      return (
        <View>
          <Text>An Error has occurred</Text>
        </View>
      );
    } else {
      return this.props.children;
    }
  }
}
