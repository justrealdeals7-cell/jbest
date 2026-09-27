import { Html, Head, Main, NextScript } from "next/document";

// The app had no _document.js at all, which meant no <meta viewport> tag
// was ever sent to the browser. Without it, mobile browsers fall back to
// rendering the page at a virtual desktop width (~980px) and zooming out
// to fit — this is the root cause of "mobile view isn't optimized": text,
// buttons and the bottom nav were never actually laid out for a phone
// screen, they were just shrunk to fit one.
//
// `viewport-fit=cover` additionally lets the page draw under the iOS
// notch/home-indicator safe areas so `env(safe-area-inset-*)` (already
// used in BottomNav) actually has a non-zero value to work with.
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#3E8E41" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
