/**
 * NavIcon – Iconos vectoriales SVG para la barra de navegación de SENA Match.
 * Reemplazan los emojis por SVG limpios al estilo Facebook/Meta.
 * Compatibles con modo claro y oscuro via props de color.
 */
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface NavIconProps {
  name: 'home' | 'discover' | 'parches' | 'chats' | 'profile' | 'bell' | 'shield';
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function NavIcon({
  name,
  size = 24,
  color = '#9EB0A5',
  strokeWidth = 2,
}: NavIconProps) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
  };

  switch (name) {
    case 'home':
      return (
        <Svg {...svgProps}>
          <Path
            d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'discover':
      return (
        <Svg {...svgProps}>
          <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} />
          <Path
            d="M21 21L16.65 16.65"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'parches':
      return (
        <Svg {...svgProps}>
          <Path
            d="M17 21V19C17 17.3431 15.6569 16 14 16H10C8.34315 16 7 17.3431 7 19V21"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} />
          <Path
            d="M23 21V19C22.9986 17.5272 22.0316 16.2338 20.6 15.87"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M16.6 3.13C18.0315 3.49213 18.9987 4.78397 18.9987 6.25683C18.9987 7.72969 18.0315 9.02153 16.6 9.38"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chats':
      return (
        <Svg {...svgProps}>
          <Path
            d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'profile':
      return (
        <Svg {...svgProps}>
          <Path
            d="M20 21V19C20 17.3431 18.6569 16 17 16H7C5.34315 16 4 17.3431 4 19V21"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} />
        </Svg>
      );

    case 'bell':
      return (
        <Svg {...svgProps}>
          <Path
            d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'shield':
      return (
        <Svg {...svgProps}>
          <Path
            d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 12L11 14L15 10"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    default:
      return null;
  }
}
