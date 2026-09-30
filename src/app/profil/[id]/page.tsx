import { redirect } from "next/navigation";

export default async function OldProfile({ params }: PageProps<"/profil/[id]">) {
  redirect(`/u/${(await params).id}`);
}
