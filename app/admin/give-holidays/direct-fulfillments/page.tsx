import { requireAppUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import DirectFulfillmentClient from "./direct-fulfillment-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireAppUser("/admin/give-holidays/direct-fulfillments");
  if (!isPlatformAdmin(user))
    return (
      <main className="grid min-h-screen place-items-center">
        Platform administrator access required.
      </main>
    );
  return <DirectFulfillmentClient />;
}
