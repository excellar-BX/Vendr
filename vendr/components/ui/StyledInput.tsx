import { TextInput, TextInputProps } from 'react-native';

export function StyledInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      style={[{ fontFamily: 'SpaceGrotesk_400Regular' }, style]}
      {...props}
    />
  );
}