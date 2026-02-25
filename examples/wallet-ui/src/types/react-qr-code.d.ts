declare module 'react-qr-code' {
  import type { CSSProperties } from 'react';
  type QRCodeProps = {
    value: string;
    size?: number;
    className?: string;
    style?: CSSProperties;
    bgColor?: string;
    fgColor?: string;
  };
  export default function QRCode(props: QRCodeProps): JSX.Element;
}
