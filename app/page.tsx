// app/page.tsx
// Server Component - just renders the client app
import dynamic from "next/dynamic";

// Disable SSR for this component - needed for useSession/Context
const MainApp = dynamic(() => import("./MainApp"), { ssr: false });

export default function Page() {
  return <MainApp />;
}