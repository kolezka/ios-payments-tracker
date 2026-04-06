import { Hono } from "hono";
import { logger } from "../logger";
import type { User } from "../types";

const shortcut = new Hono();

function generateShortcutPlist(apiUrl: string, token: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowMinimumClientVersion</key>
  <string>900</string>
  <key>WFWorkflowMinimumClientVersionString</key>
  <string>900</string>
  <key>WFWorkflowImportQuestions</key>
  <array/>
  <key>WFWorkflowTypes</key>
  <array>
    <string>WatchKit</string>
    <string>NCWidget</string>
  </array>
  <key>WFWorkflowInputContentItemClasses</key>
  <array/>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconStartColor</key>
    <integer>4274264319</integer>
    <key>WFWorkflowIconGlyphNumber</key>
    <integer>59470</integer>
  </dict>
  <key>WFWorkflowName</key>
  <string>Dodaj Platnosc</string>
  <key>WFWorkflowActions</key>
  <array>
    <!-- Build JSON from Wallet automation magic variables -->
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.dictionary</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFItems</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>WFDictionaryFieldValueItems</key>
            <array>
              <!-- amount from Wallet Amount -->
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>amount</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>string</key>
                    <string>\uFFFC</string>
                    <key>attachmentsByRange</key>
                    <dict>
                      <key>{0, 1}</key>
                      <dict>
                        <key>Type</key>
                        <string>Variable</string>
                        <key>VariableName</key>
                        <string>Amount</string>
                      </dict>
                    </dict>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
              <!-- seller from Wallet Merchant -->
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>seller</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>string</key>
                    <string>\uFFFC</string>
                    <key>attachmentsByRange</key>
                    <dict>
                      <key>{0, 1}</key>
                      <dict>
                        <key>Type</key>
                        <string>Variable</string>
                        <key>VariableName</key>
                        <string>Merchant</string>
                      </dict>
                    </dict>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
              <!-- card from Wallet Card -->
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>card</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>string</key>
                    <string>\uFFFC</string>
                    <key>attachmentsByRange</key>
                    <dict>
                      <key>{0, 1}</key>
                      <dict>
                        <key>Type</key>
                        <string>Variable</string>
                        <key>VariableName</key>
                        <string>Card</string>
                      </dict>
                    </dict>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
            </array>
          </dict>
        </dict>
      </dict>
    </dict>
    <!-- POST to API -->
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key>
        <string>${apiUrl}/api/transactions</string>
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
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>Authorization</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>Bearer ${token}</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>Content-Type</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict><key>string</key><string>application/json</string></dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
            </array>
          </dict>
        </dict>
        <key>WFHTTPBodyType</key>
        <string>Json</string>
        <key>WFJSONValues</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenAttachment</string>
            <key>Value</key>
            <dict>
              <key>Type</key>
              <string>ActionOutput</string>
              <key>OutputName</key>
              <string>Dictionary</string>
            </dict>
          </dict>
        </dict>
      </dict>
    </dict>
    <!-- Notification -->
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.notification</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFNotificationActionBody</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>string</key>
            <string>\uFFFC zl u \uFFFC</string>
            <key>attachmentsByRange</key>
            <dict>
              <key>{0, 1}</key>
              <dict>
                <key>Type</key>
                <string>Variable</string>
                <key>VariableName</key>
                <string>Amount</string>
              </dict>
              <key>{6, 1}</key>
              <dict>
                <key>Type</key>
                <string>Variable</string>
                <key>VariableName</key>
                <string>Merchant</string>
              </dict>
            </dict>
          </dict>
          <key>WFSerializationType</key>
          <string>WFTextTokenString</string>
        </dict>
        <key>WFNotificationActionTitle</key>
        <string>Payment Tracker</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
}

shortcut.get("/download", (c) => {
  const user = c.get("user") as User;
  const apiUrl = process.env.BASE_URL ?? "http://localhost:3010";

  const plist = generateShortcutPlist(apiUrl, user.api_token);

  logger.info({ userId: user.id }, "shortcut file downloaded");

  return new Response(plist, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Dodaj Platnosc.shortcut"',
    },
  });
});

export default shortcut;
