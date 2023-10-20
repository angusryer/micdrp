import React, { useState } from 'react';
import {
  Button,
  // NativeModules,
  SafeAreaView,
  StatusBar,
  Text,
  useColorScheme
} from 'react-native';
import Config from 'react-native-config';
import { Colors } from 'react-native/Libraries/NewAppScreen';

// Impl this:  const { AudioControlModule } = NativeModules;

interface IColors {
  white: string;
  black: string;
  light: string;
  dark: string;
  darker: string;
  lighter: string;
}

const colors: IColors = Colors as IColors;

const App = () => {
  const [test, setTest] = useState<string>('');
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? colors.darker : colors.lighter
  };

  const runTest = async () => {
    // Implement this: const test = await AudioControlModule.getDeviceList();
    // And this: setTest(test);
    const test = await Promise.resolve('TEST');
    console.log(test);
  };

  const reset = () => {
    setTest('');
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      
      <Text>Environment: {JSON.stringify(Config)}</Text>
      <Button onPress={() => void runTest()} title='Run log' />
      <Button onPress={reset} title='Reset' />
      <Text>{String(test)}</Text>
    </SafeAreaView>
  );
};

export default App;
