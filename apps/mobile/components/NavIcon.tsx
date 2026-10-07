/**
 * NavIcon – Iconos vectoriales SVG para la barra de navegación de SENA Match.
 * Reemplazan los emojis por SVG limpios al estilo Facebook/Meta.
 * Compatibles con modo claro y oscuro via props de color.
 */
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export type NavIconName =
  | 'home' | 'discover' | 'parches' | 'chats' | 'profile' | 'bell' | 'shield'
  | 'heart' | 'add' | 'camera' | 'photo' | 'alert' | 'refresh' | 'edit' | 'trash'
  | 'flag' | 'book' | 'clock' | 'location' | 'calendar' | 'settings' | 'check'
  | 'sparkles' | 'crown' | 'lock' | 'unlock' | 'upload' | 'chart' | 'users'
  | 'mail' | 'tag' | 'school' | 'sun' | 'moon' | 'close' | 'send' | 'target'
  | 'food' | 'coffee' | 'sport' | 'theater' | 'sad' | 'more' | 'info'
  | 'smile' | 'glasses' | 'animal' | 'flame' | 'gaming' | 'music' | 'film'
  | 'code' | 'art' | 'fitness' | 'plane' | 'paw';

export function getAvatarIconName(emoji?: string | null): NavIconName {
  switch (emoji) {
    case '😊': case '😎': return 'smile';
    case '🤓': return 'glasses';
    case '🦊': case '🦄': return 'animal';
    case '🐱': case '🐶': return 'paw';
    case '🌟': return 'sparkles';
    case '🔥': return 'flame';
    case '🎯': return 'target';
    case '💪': return 'fitness';
    case '🎓': return 'school';
    default: return 'profile';
  }
}

interface NavIconProps {
  name: NavIconName;
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

    case 'heart':
      return <Svg {...svgProps}><Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'add':
      return <Svg {...svgProps}><Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'camera':
      return <Svg {...svgProps}><Path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Circle cx="12" cy="13" r="3.5" stroke={color} strokeWidth={strokeWidth} /></Svg>;
    case 'photo':
      return <Svg {...svgProps}><Path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M2 16l5-5 4 4 3-3 8 7" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Circle cx="16.5" cy="8" r="1.5" stroke={color} strokeWidth={strokeWidth} /></Svg>;
    case 'alert':
      return <Svg {...svgProps}><Path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z M12 9v4m0 4h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'refresh':
      return <Svg {...svgProps}><Path d="M20 7v5h-5M4 17v-5h5M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'edit':
      return <Svg {...svgProps}><Path d="m14 6 4 4M3 21l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L3 21Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'trash':
      return <Svg {...svgProps}><Path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m4 4v7m6-7v7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'flag':
      return <Svg {...svgProps}><Path d="M5 21V4m0 1c6-4 8 4 14 0v10c-6 4-8-4-14 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'book':
      return <Svg {...svgProps}><Path d="M4 5a3 3 0 0 1 3-3h13v18H7a3 3 0 0 0-3 3V5Zm0 0v15a3 3 0 0 1 3-3h13" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /></Svg>;
    case 'clock':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} /><Path d="M12 7v5l3 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'location':
      return <Svg {...svgProps}><Path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke={color} strokeWidth={strokeWidth} /><Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth} /></Svg>;
    case 'calendar':
      return <Svg {...svgProps}><Path d="M4 5h16a2 2 0 0 1 2 2v13H2V7a2 2 0 0 1 2-2Zm-2 5h20M8 2v6m8-6v6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'settings':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} /><Path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.3a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12H1.5a2 2 0 1 1 0-4h.2a2 2 0 0 0 1.4-3.4L3 4.5a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 9.3.4V.3a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.9 8h.2a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1.5 3Z" stroke={color} strokeWidth={strokeWidth} transform="translate(1 2) scale(.92)" /></Svg>;
    case 'check':
      return <Svg {...svgProps}><Path d="m5 12 4 4L19 6" stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'sparkles':
      return <Svg {...svgProps}><Path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15ZM5 2l.7 2.3L8 5l-2.3.7L5 8l-.7-2.3L2 5l2.3-.7L5 2Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /></Svg>;
    case 'crown':
      return <Svg {...svgProps}><Path d="m2 7 5 4 5-7 5 7 5-4-2 12H4L2 7Zm2 15h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'lock':
      return <Svg {...svgProps}><Path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4m-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'unlock':
      return <Svg {...svgProps}><Path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2M12 15v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'upload':
      return <Svg {...svgProps}><Path d="M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'chart':
      return <Svg {...svgProps}><Path d="M4 20V10m6 10V4m6 16v-7m6 7H2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'users':
      return <Svg {...svgProps}><Circle cx="9" cy="8" r="3" stroke={color} strokeWidth={strokeWidth} /><Path d="M3 20v-1a6 6 0 0 1 12 0v1m2-15a3 3 0 0 1 0 6m1 2a5 5 0 0 1 3 5v1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'mail':
      return <Svg {...svgProps}><Path d="M3 5h18v14H3zM3 7l9 6 9-6" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /></Svg>;
    case 'tag':
      return <Svg {...svgProps}><Path d="M20 13 13 20 3 10V3h7l10 10Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Circle cx="7" cy="7" r="1" stroke={color} strokeWidth={strokeWidth} /></Svg>;
    case 'school':
      return <Svg {...svgProps}><Path d="m2 9 10-6 10 6-10 6L2 9Zm4 3v5c4 3 8 3 12 0v-5M22 9v6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'sun':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={strokeWidth} /><Path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'moon':
      return <Svg {...svgProps}><Path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 9 9 0 1 0 20.5 15.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'close':
      return <Svg {...svgProps}><Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'send':
      return <Svg {...svgProps}><Path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'target':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} /><Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={strokeWidth} /><Circle cx="12" cy="12" r="1" stroke={color} strokeWidth={strokeWidth} /></Svg>;
    case 'food':
      return <Svg {...svgProps}><Path d="M4 3v7m-2-7v4a2 2 0 0 0 4 0V3m-2 7v11m13-18v18m0-18c-3 2-4 5-4 9h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'coffee':
      return <Svg {...svgProps}><Path d="M4 8h13v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm13 2h2a2 2 0 0 1 0 4h-2M8 3v2m5-2v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'sport':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} /><Path d="m7 5 4 2-1 5-4 2m11-9-4 2 1 5 4 2M8 19l4-4 4 4" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /></Svg>;
    case 'theater':
      return <Svg {...svgProps}><Path d="M4 4h16v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4Zm4 5h.01M16 9h.01M8 14c2 2 6 2 8 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'sad':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} /><Path d="M8 15c1-2 7-2 8 0m-7-5h.01M15 10h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'more':
      return <Svg {...svgProps}><Circle cx="5" cy="12" r="1" fill={color} /><Circle cx="12" cy="12" r="1" fill={color} /><Circle cx="19" cy="12" r="1" fill={color} /></Svg>;
    case 'info':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} /><Path d="M12 11v5m0-8h.01" stroke={color} strokeWidth={strokeWidth + 0.3} strokeLinecap="round" /></Svg>;
    case 'smile':
      return <Svg {...svgProps}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} /><Path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'glasses':
      return <Svg {...svgProps}><Circle cx="8" cy="13" r="3.5" stroke={color} strokeWidth={strokeWidth} /><Circle cx="16" cy="13" r="3.5" stroke={color} strokeWidth={strokeWidth} /><Path d="M11.5 13h1M3 12l1-4h4m12 4-1-4h-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'animal':
      return <Svg {...svgProps}><Path d="M5 10 4 4l5 3a9 9 0 0 1 6 0l5-3-1 6a8 8 0 1 1-14 0Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Path d="M9 14h.01M15 14h.01M10 17c1.2 1 2.8 1 4 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'flame':
      return <Svg {...svgProps}><Path d="M12 22a8 8 0 0 0 8-8c0-4-3-6-5-10 0 4-2 5-3 6-1-3-3-5-4-6 0 4-4 7-4 11a8 8 0 0 0 8 7Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Path d="M9 17a3 3 0 0 0 6 0c0-1.5-1.5-3-2.5-4-1 2-3.5 2.5-3.5 4Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /></Svg>;
    case 'gaming':
      return <Svg {...svgProps}><Path d="M6 8h12a4 4 0 0 1 3.8 5l-1 4a2.5 2.5 0 0 1-4.2 1.2L14 16h-4l-2.6 2.2A2.5 2.5 0 0 1 3.2 17l-1-4A4 4 0 0 1 6 8Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Path d="M7 11v4m-2-2h4m7-.5h.01M18 14.5h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></Svg>;
    case 'music':
      return <Svg {...svgProps}><Path d="M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'film':
      return <Svg {...svgProps}><Path d="M3 4h18v16H3zM3 8h18M3 16h18M7 4v4m5-4v4m5-4v4M7 16v4m5-4v4m5-4v4" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /></Svg>;
    case 'code':
      return <Svg {...svgProps}><Path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'art':
      return <Svg {...svgProps}><Path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h1.2A4.9 4.9 0 0 0 22 10C22 6.1 17.5 3 12 3Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Circle cx="7.5" cy="11" r="1" fill={color} /><Circle cx="10" cy="7.5" r="1" fill={color} /><Circle cx="15" cy="7.5" r="1" fill={color} /></Svg>;
    case 'fitness':
      return <Svg {...svgProps}><Path d="M3 9v6m4-9v12m10-12v12m4-9v6M7 12h10" stroke={color} strokeWidth={strokeWidth + 0.5} strokeLinecap="round" /></Svg>;
    case 'plane':
      return <Svg {...svgProps}><Path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'paw':
      return <Svg {...svgProps}><Path d="M7 13c-2 0-3 2-2 4 .8 1.5 2.4 1.3 4 .3 2-1.2 4-1.2 6 0 1.6 1 3.2 1.2 4-.3 1-2-1-4-3-4-2 0-2.3 1-4.5 1S9 13 7 13Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" /><Circle cx="6" cy="8" r="1.6" stroke={color} strokeWidth={strokeWidth} /><Circle cx="10" cy="5.5" r="1.6" stroke={color} strokeWidth={strokeWidth} /><Circle cx="15" cy="5.5" r="1.6" stroke={color} strokeWidth={strokeWidth} /><Circle cx="19" cy="8" r="1.6" stroke={color} strokeWidth={strokeWidth} /></Svg>;

    default:
      return null;
  }
}
