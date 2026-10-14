import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <div className="font-mono text-sm text-fg-3">404</div>
        <h1 className="mt-1 text-xl font-semibold">Page not found</h1>
        <Link href="/overview" className="mt-4 inline-block text-sm underline underline-offset-4">Go to Operations Overview</Link>
      </div>
    </main>
  );
}
