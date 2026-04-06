import { Hono } from "hono";
import db from "../db";
import type { User } from "../types";
import { logger } from "../logger";

const shortcut = new Hono();

shortcut.get("/download", (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3010";
  const apiUrl = `${baseUrl}/api/transactions`;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowActions</key>
  <array>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Amount</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>amount</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Seller</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>seller</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Card (optional)</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>card</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Title (optional)</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>title</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key>
        <string>${apiUrl}</string>
        <key>WFHTTPMethod</key>
        <string>POST</string>
        <key>WFHTTPHeaders</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>WFDictionaryFieldValueItems</key>
            <array>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <string>Authorization</string>
                <key>WFValue</key>
                <string>Bearer ${user.api_token}</string>
              </dict>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <string>Content-Type</string>
                <key>WFValue</key>
                <string>application/json</string>
              </dict>
            </array>
          </dict>
        </dict>
        <key>WFHTTPBodyType</key>
        <string>Json</string>
      </dict>
    </dict>
  </array>
  <key>WFWorkflowName</key>
  <string>Add Payment</string>
  <key>WFWorkflowMinimumClientVersion</key>
  <string>900</string>
</dict>
</plist>`;

  logger.info({ userId: user.id }, "shortcut file downloaded");

  return new Response(plist, {
    headers: {
      "Content-Type": "application/x-apple-shortcut",
      "Content-Disposition": 'attachment; filename="Add Payment.shortcut"',
    },
  });
});

export default shortcut;
