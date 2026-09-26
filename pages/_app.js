import BottomNav from "../components/BottomNav";

export default function App({ Component, pageProps }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FBF6E9", paddingBottom: 72 }}>
      <Component {...pageProps} />
      <BottomNav />
    </div>
  );
}
