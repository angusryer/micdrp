import React from 'react';
import { SafeAreaView, StatusBar, Text, useColorScheme } from 'react-native';
import Config from 'react-native-config';
import { Colors } from 'react-native/Libraries/NewAppScreen';

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
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? colors.darker : colors.lighter
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <Text>Environment: {JSON.stringify(Config)}</Text>
    </SafeAreaView>
  );
};

export default App;
