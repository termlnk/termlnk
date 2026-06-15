import Svg, { Path } from 'react-native-svg';

interface IKeyboardHideIconProps {
  readonly size?: number;
  readonly color?: string;
}

export function KeyboardHideIcon({ size = 24, color = 'currentColor' }: IKeyboardHideIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="m12 23l4-4H8M4 3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 2h16v10H4zm1 1v2h2V6zm3 0v2h2V6zm3 0v2h2V6zm3 0v2h2V6zm3 0v2h2V6zM5 9v2h2V9zm3 0v2h2V9zm3 0v2h2V9zm3 0v2h2V9zm3 0v2h2V9zm-9 3v2h8v-2z"
      />
    </Svg>
  );
}
