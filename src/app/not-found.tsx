import Link from "next/link";
import { BeeMark } from "@/components/Logo";
import { getDictionary } from "@/lib/i18n";

export default async function NotFound() {
  const { locale } = await getDictionary();
  const en = locale === "en";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <BeeMark size={110} />
      <h1 className="display mt-6 text-3xl">{en ? "Bzzz… lost your way?" : "Bzzz… zgubiłeś się?"}</h1>
      <p className="mt-2 text-muted">{en ? "This page isn't in our hive." : "Tej strony nie ma w naszym ulu."}</p>
      <Link href="/" className="btn-primary mt-6">
        {en ? "Back to start" : "Wróć na start"}
      </Link>
    </div>
  );
}
