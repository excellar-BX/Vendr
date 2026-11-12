import { TextInput, TextInputProps } from 'react-native';
import { Colors, Fonts } from '../../constants/colors';
import { T, useTheme } from '../../constants/theme';

export function StyledInput({ style, ...props }: TextInputProps) {
  useTheme();
  return (
    <TextInput
      placeholderTextColor={Colors.ink3}
      selectionColor={Colors.primary}
      cursorColor={Colors.primary}
      keyboardAppearance={Colors.isDark ? 'dark' : 'light'}
      {...props}
      style={[{ fontFamily: Fonts.regular, color: Colors.ink }, style]}
    />
  );
}
