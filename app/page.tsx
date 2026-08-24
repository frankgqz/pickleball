// app/page.tsx
// Server Component - forces dynamic rendering, no static pre-render
export const dynamic = 'force-dynamic';
import ClientWrapper from "./ClientWrapper";
export default function Page() {
  return <ClientWrapper />;
}