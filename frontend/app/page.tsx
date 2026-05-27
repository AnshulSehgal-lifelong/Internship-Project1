import { redirect } from "next/navigation";

// App entry point redirect.
export default function Home() {
  redirect("/dashboard");
}
