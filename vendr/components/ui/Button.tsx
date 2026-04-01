import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: IoniconsName;
  iconRight?: IoniconsName;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, {
  container: string;
  textColor: string;
  fontFamily: string;
  iconColor: string;
  shadow?: object;
}> = {
  primary: {
    container: 'bg-orange',
    textColor: 'text-white',
    fontFamily: 'SpaceGrotesk_700Bold',
    iconColor: 'white',
    shadow: {
      shadowColor: '#E8521A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  secondary: {
    container: 'bg-dark-2 border border-faint',
    textColor: 'text-cream',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    iconColor: '#FDF6EC',
  },
  outline: {
    container: 'bg-transparent border border-orange',
    textColor: 'text-orange',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    iconColor: '#E8521A',
  },
  ghost: {
    container: 'bg-transparent',
    textColor: 'text-orange',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    iconColor: '#E8521A',
  },
  danger: {
    container: 'bg-brand-red',
    textColor: 'text-white',
    fontFamily: 'SpaceGrotesk_700Bold',
    iconColor: 'white',
    shadow: {
      shadowColor: '#E85555',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};

const sizeStyles: Record<ButtonSize, { container: string; textSize: string; iconSize: number }> = {
  sm: { container: 'px-4 py-2.5 rounded-xl', textSize: 'text-sm', iconSize: 16 },
  md: { container: 'px-6 py-4 rounded-2xl', textSize: 'text-base', iconSize: 18 },
  lg: { container: 'px-8 py-[18px] rounded-2xl', textSize: 'text-lg', iconSize: 20 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = true,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={v.shadow}
      className={`
        ${v.container} ${s.container}
        ${fullWidth ? 'w-full' : 'self-start'}
        flex-row items-center justify-center gap-2
        ${isDisabled ? 'opacity-60' : ''}
      `}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? 'white' : '#E8521A'}
        />
      ) : (
        <>
          {iconLeft && <Ionicons name={iconLeft} size={s.iconSize} color={v.iconColor} />}
          <Text
            className={`${v.textColor} ${s.textSize}`}
            style={{ fontFamily: v.fontFamily }}
          >
            {label}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={s.iconSize} color={v.iconColor} />}
        </>
      )}
    </TouchableOpacity>
  );
}