import { redirect } from "next/navigation";

export default async function LegacyPage({ searchParams }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item != null) params.append(key, item);
  }
  redirect(`/${params.size ? `?${params}` : ""}#moderation`);
}
