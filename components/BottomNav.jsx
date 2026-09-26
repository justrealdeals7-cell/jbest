import Link from "next/link";
import { useRouter } from "next/router";
import { Home, UserPlus, QrCode, ShieldCheck, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/register", label: "Register", icon: UserPlus, match: (p) => p.startsWith("/register") },
  { href: "/verify", label: "Verify ID", icon: QrCode, match: (p) => p.startsWith("/verify") },
  { href: "/admin", label: "Admin", icon: ShieldCheck, match: (p) => p.startsWith("/admin") },
  { href: "/agent", label: "Agent", icon: Users, match: (p) => p.startsWith("/agent") },
];

export default function BottomNav() {
  const router = useRouter();

  return (
    <nav style={styles.nav}>
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(router.pathname);
        return (
          <Link key={href} href={href} style={{ ...styles.tab, color: active ? "#3E8E41" : "#8A8570" }}>
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            <span style={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    background: "#FFFDF8",
    borderTop: "1px solid #E4D9B8",
    padding: "8px 4px calc(8px + env(safe-area-inset-bottom, 0px))",
    zIndex: 50,
  },
  tab: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    textDecoration: "none",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "system-ui, sans-serif",
    flex: 1,
  },
  label: { marginTop: 2 },
};
