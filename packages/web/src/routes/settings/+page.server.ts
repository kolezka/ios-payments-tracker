import type { ServerLoad, Actions } from "@sveltejs/kit";
import { apiFetch } from "$lib/api";
import { fail } from "@sveltejs/kit";

export const load: ServerLoad = async ({ locals }) => {
  const res = await apiFetch("/api/webhooks", locals.authToken);
  const webhooks = await res.json();
  return { webhooks, user: locals.user };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const url = form.get("url") as string;
    const secret = form.get("secret") as string;
    const events = form.getAll("events").join(",") || "transaction.created";

    const res = await apiFetch("/api/webhooks", locals.authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret: secret || undefined, events }),
    });

    if (!res.ok) {
      const data = await res.json();
      return fail(400, { error: data.error ?? "Failed to create webhook" });
    }

    return { success: true };
  },

  delete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get("id") as string;
    await apiFetch(`/api/webhooks/${id}`, locals.authToken, { method: "DELETE" });
    return { success: true };
  },

  toggle: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get("id") as string;
    const active = form.get("active") === "true";
    await apiFetch(`/api/webhooks/${id}`, locals.authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    return { success: true };
  },
};
