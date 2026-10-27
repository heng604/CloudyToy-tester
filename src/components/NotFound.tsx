import { useTitle } from "@/lib/title";
export default function NotFound() {
  useTitle("Not found");
  return <div className="grid min-h-[40vh] place-items-center text-center"><div><h1 className="text-5xl font-extrabold">404</h1><p className="mt-2 text-mute">This page could not be found.</p></div></div>;
}
