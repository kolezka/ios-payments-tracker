import { fail, redirect, type Actions } from "@sveltejs/kit";
import { apiFetch } from "$lib/api";

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const name = (data.get("name") as string)?.trim();
    if (!name) { return fail(400, { error: "Name is required" }); }

    const res = await apiFetch("/api/auth/me", locals.authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) { return fail(res.status, { error: "Failed to update name" }); }
    redirect(303, "/setup");
  },
};
